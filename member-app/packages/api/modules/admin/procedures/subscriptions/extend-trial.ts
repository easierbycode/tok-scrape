import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const extendTrial = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/extend-trial",
		tags: ["Administration"],
		summary: "Extend trial period",
	})
	.input(
		z.object({
			subscriptionId: z.string(),
			days: z.number().int().positive(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { subscriptionId, days, reason } = input;
		const stripe = getStripeClient();

		// Get current subscription
		const subscription =
			await stripe.subscriptions.retrieve(subscriptionId);
		const currentTrialEnd = subscription.trial_end
			? new Date(subscription.trial_end * 1000)
			: new Date();

		// Calculate new trial end date
		const newTrialEnd = new Date(currentTrialEnd);
		newTrialEnd.setDate(newTrialEnd.getDate() + days);

		// Update subscription trial_end in Stripe
		await stripe.subscriptions.update(subscriptionId, {
			trial_end: Math.floor(newTrialEnd.getTime() / 1000),
		});

		// Update database
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				trialEnd: newTrialEnd,
			},
		});

		// Get purchase for audit log
		const purchase = await db.purchase.findUnique({
			where: { subscriptionId },
			include: { user: { select: { email: true } } },
		});

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "EXTEND_TRIAL",
			targetType: "subscription",
			targetId: subscriptionId,
			summary: `Extended trial by ${days} day(s) for ${purchase?.user?.email ?? subscriptionId}`,
			metadata: {
				reason,
				days,
				newTrialEnd: newTrialEnd.toISOString(),
				userId: purchase?.userId,
			},
		});

		return { success: true };
	});
