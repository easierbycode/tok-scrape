import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const convertTrial = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/convert-trial",
		tags: ["Administration"],
		summary: "Convert trial to paid subscription",
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

		// End trial immediately by setting trial_end to now
		await stripe.subscriptions.update(subscriptionId, {
			trial_end: "now",
		});

		// Update database - set status to active and clear trial end
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				status: "active",
				trialEnd: null,
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
			action: "EXTEND_TRIAL", // Using EXTEND_TRIAL for trial conversion
			targetType: "subscription",
			targetId: subscriptionId,
			summary: `Converted trial to paid for ${purchase?.user?.email ?? subscriptionId}`,
			metadata: {
				reason,
				action: "convert_trial",
				userId: purchase?.userId,
			},
		});

		return { success: true };
	});
