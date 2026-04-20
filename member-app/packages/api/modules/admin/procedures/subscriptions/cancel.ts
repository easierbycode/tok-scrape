import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { changeToGracePeriodRole, resolvePlanRoleId } from "@repo/discord";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const cancelSubscription = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/cancel",
		tags: ["Administration"],
		summary: "Cancel subscription",
	})
	.input(
		z.object({
			subscriptionId: z.string(),
			immediate: z.boolean(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { subscriptionId, immediate, reason } = input;
		const stripe = getStripeClient();

		// Get purchase record with user info
		const purchase = await db.purchase.findUnique({
			where: { subscriptionId },
			include: { user: true },
		});

		if (!purchase) {
			throw new Error("Purchase not found");
		}

		if (!purchase.user) {
			throw new Error("Purchase has no associated user");
		}

		// Cancel in Stripe
		if (immediate) {
			await stripe.subscriptions.cancel(subscriptionId);
		} else {
			await stripe.subscriptions.update(subscriptionId, {
				cancel_at_period_end: true,
			});
		}

		// Update database
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				status: immediate ? "canceled" : purchase.status,
				cancelAtPeriodEnd: !immediate,
				cancelledAt: immediate ? new Date() : purchase.cancelledAt,
			},
		});

		// Send cancellation email
		if (purchase.user.email) {
			const reactivateUrl = process.env.NEXT_PUBLIC_APP_URL
				? `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`
				: "#";

			await sendEmail({
				to: purchase.user.email,
				templateId: "subscriptionCanceled",
				context: {
					name: purchase.user.name,
					cancelledAt: immediate
						? new Date()
						: purchase.currentPeriodEnd || new Date(),
					reactivateUrl,
				},
			}).catch((error) => {
				logger.error("Failed to send cancellation email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
		}

		// Change Discord role to grace period (NOT removal)
		if (purchase.user.discordId) {
			const planRoleId = purchase.user.discordRoleKey
				? resolvePlanRoleId(purchase.user.discordRoleKey)
				: null;
			const result = await changeToGracePeriodRole(
				purchase.user.discordId,
				planRoleId ?? undefined,
			);
			if (!result.success) {
				logger.error("Discord role change failed (cancel)", {
					userId: purchase.userId,
					discordId: purchase.user.discordId,
					error: result.error,
				});
				// Continue - don't fail the operation
			}
		}

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CANCEL_SUBSCRIPTION",
			targetType: "subscription",
			targetId: subscriptionId,
			summary: immediate
				? `Immediately canceled subscription for ${purchase.user.email} (admin subscriptions page)`
				: `Scheduled cancel at period end for ${purchase.user.email} (admin subscriptions page)`,
			metadata: {
				reason,
				immediate,
				userId: purchase.userId,
			},
		});

		return { success: true };
	});
