import { ORPCError } from "@orpc/server";
import {
	createPurchase,
	db,
	getPurchaseBySubscriptionId,
	updatePurchase,
} from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { getStripeClient, setCustomerIdToEntity } from "@repo/payments";
import type Stripe from "stripe";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const ImportFromStripeInputSchema = z.object({
	subscriptions: z.array(
		z.object({
			subscriptionId: z.string().min(1),
			customerId: z.string().min(1),
			customerEmail: z.string().email(),
			customerName: z.string().optional(),
		}),
	),
});

export const importFromStripe = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/import-from-stripe",
		tags: ["Administration"],
		summary:
			"Create app users and link purchases for selected Stripe subscriptions",
	})
	.input(ImportFromStripeInputSchema)
	.handler(async ({ input, context }) => {
		const { subscriptions: selected } = input;

		if (selected.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Select at least one subscription to import",
			});
		}

		const stripe = getStripeClient();
		let imported = 0;
		let skipped = 0;
		const errors: string[] = [];

		for (const row of selected) {
			const {
				subscriptionId,
				customerId,
				customerEmail,
				customerName: inputCustomerName,
			} = row;

			try {
				const existingPurchase =
					await getPurchaseBySubscriptionId(subscriptionId);
				if (existingPurchase) {
					skipped++;
					continue;
				}

				const normalizedEmail = customerEmail.trim().toLowerCase();

				let user = await db.user.findFirst({
					where: {
						deletedAt: null,
						paymentsCustomerId: customerId,
					},
				});

				const deletedUser = await db.user.findFirst({
					where: {
						deletedAt: { not: null },
						OR: [
							{
								email: {
									equals: normalizedEmail,
									mode: "insensitive",
								},
							},
							{
								stripeEmail: {
									equals: normalizedEmail,
									mode: "insensitive",
								},
							},
						],
					},
				});

				if (deletedUser) {
					skipped++;
					continue;
				}

				if (!user) {
					user = await db.user.findFirst({
						where: {
							deletedAt: null,
							OR: [
								{
									email: {
										equals: normalizedEmail,
										mode: "insensitive",
									},
								},
								{
									stripeEmail: {
										equals: normalizedEmail,
										mode: "insensitive",
									},
								},
							],
						},
					});
				}

				const stripeCustomerRaw =
					await stripe.customers.retrieve(customerId);
				if (
					typeof stripeCustomerRaw === "string" ||
					("deleted" in stripeCustomerRaw &&
						stripeCustomerRaw.deleted)
				) {
					skipped++;
					continue;
				}
				const stripeCustomer = stripeCustomerRaw as Stripe.Customer;

				const resolvedEmail =
					stripeCustomer.email?.trim() || customerEmail.trim();
				const resolvedName =
					inputCustomerName?.trim() ||
					stripeCustomer.name?.trim() ||
					resolvedEmail.split("@")[0] ||
					"Subscriber";

				if (!user) {
					user = await db.user.create({
						data: {
							email: resolvedEmail,
							stripeEmail: resolvedEmail,
							notificationEmail: resolvedEmail,
							name: resolvedName,
							emailVerified: true,
							onboardingComplete: false,
							paymentsCustomerId: customerId,
							createdAt: new Date(),
							updatedAt: new Date(),
						},
					});
				} else {
					await db.user.update({
						where: { id: user.id },
						data: {
							stripeEmail: user.stripeEmail ?? resolvedEmail,
							paymentsCustomerId:
								user.paymentsCustomerId ?? customerId,
							updatedAt: new Date(),
						},
					});
				}

				const subscriptionRaw = await stripe.subscriptions.retrieve(
					subscriptionId,
					{
						expand: ["items.data.price"],
					},
				);
				const subscription = subscriptionRaw as unknown as {
					items: { data: { price?: { id?: string } | string }[] };
					status: string;
					current_period_end?: number;
					trial_end?: number | null;
					cancel_at_period_end?: boolean;
				};

				const priceObj = subscription.items.data[0]?.price;
				const priceId =
					typeof priceObj === "string" ? priceObj : priceObj?.id;
				if (!priceId) {
					skipped++;
					continue;
				}

				const periodEndSec = subscription.current_period_end;
				const trialEndSec = subscription.trial_end;

				await createPurchase({
					subscriptionId,
					organizationId: null,
					userId: user.id,
					customerId,
					type: "SUBSCRIPTION",
					productId: priceId,
					status: subscription.status,
					currentPeriodEnd: periodEndSec
						? new Date(periodEndSec * 1000)
						: null,
					cancelAtPeriodEnd:
						subscription.cancel_at_period_end ?? false,
					trialEnd: trialEndSec ? new Date(trialEndSec * 1000) : null,
					stripeSyncedAt: new Date(),
				});

				const existingActive = await db.purchase.findMany({
					where: {
						userId: user.id,
						type: "SUBSCRIPTION",
						status: { in: ["active", "trialing", "grace_period"] },
						NOT: { subscriptionId },
					},
				});

				for (const oldPurchase of existingActive) {
					try {
						if (oldPurchase.subscriptionId) {
							await stripe.subscriptions.cancel(
								oldPurchase.subscriptionId,
							);
						}
						await updatePurchase({
							id: oldPurchase.id,
							status: "cancelled",
						});
						logger.info(
							"Auto-cancelled old subscription during import",
							{
								oldSubscriptionId: oldPurchase.subscriptionId,
								newSubscriptionId: subscriptionId,
								userId: user.id,
							},
						);
					} catch (error) {
						logger.error(
							"Failed to auto-cancel old subscription on import",
							{
								purchaseId: oldPurchase.id,
								error:
									error instanceof Error
										? error.message
										: String(error),
							},
						);
					}
				}

				await setCustomerIdToEntity(customerId, { userId: user.id });

				imported++;

				await logAdminAction({
					adminUserId: context.user.id,
					action: "SYSTEM_ACTION",
					targetType: "purchase",
					targetId: subscriptionId,
					summary: `Imported Stripe subscription ${subscriptionId} for ${user.email}`,
					metadata: {
						kind: "stripe_import",
						userId: user.id,
						customerId,
					},
				});
			} catch (error) {
				const message =
					error instanceof Error ? error.message : String(error);
				logger.error("Stripe import row failed", {
					subscriptionId,
					error: message,
				});
				errors.push(`${subscriptionId}: ${message}`);
			}
		}

		return {
			success: true,
			imported,
			skipped,
			errors,
		};
	});
