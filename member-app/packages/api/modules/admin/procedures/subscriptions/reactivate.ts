import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { grantActiveRole } from "@repo/discord/lib/manage-roles";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { getMarketingPlanNameByStripePriceId } from "../../../../lib/plan-display-name";
import { adminProcedure } from "../../../../orpc/procedures";

export const reactivateSubscription = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/reactivate",
		tags: ["Administration"],
		summary: "Reactivate canceled subscription",
	})
	.input(
		z.object({
			subscriptionId: z.string(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { subscriptionId, reason } = input;
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

		// Reactivate subscription in Stripe
		// If subscription was canceled, we need to resume it
		// If it was set to cancel_at_period_end, remove that flag
		await stripe.subscriptions.update(subscriptionId, {
			cancel_at_period_end: false,
		});

		// Update database
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				status: "active",
				cancelAtPeriodEnd: false,
			},
		});

		// Send reactivation email
		if (purchase.user.email) {
			const nextBillingDate = purchase.currentPeriodEnd || new Date();
			const planName = await getMarketingPlanNameByStripePriceId(
				purchase.productId,
			);

			await sendEmail({
				to: purchase.user.email,
				templateId: "subscriptionReactivated",
				context: {
					name: purchase.user.name,
					planName,
					nextBillingDate,
				},
			}).catch((error) => {
				logger.error("Failed to send reactivation email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
		}

		// Grant Discord Active Member role
		if (purchase.user.discordId) {
			const result = await grantActiveRole(purchase.user.discordId);
			if (!result.success) {
				logger.error("Discord role grant failed (reactivate)", {
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
			action: "CANCEL_SUBSCRIPTION", // Using cancel action but with reactivate metadata
			targetType: "subscription",
			targetId: subscriptionId,
			summary: `Reactivated subscription for ${purchase.user.email}`,
			metadata: {
				reason,
				action: "reactivate",
				userId: purchase.userId,
			},
		});

		return { success: true, subscriptionId };
	});
