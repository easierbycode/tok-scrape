import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const applyCoupon = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/apply-coupon",
		tags: ["Administration"],
		summary: "Apply coupon to subscription",
	})
	.input(
		z.object({
			subscriptionId: z.string(),
			couponId: z.string(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { subscriptionId, couponId, reason } = input;
		const stripe = getStripeClient();

		// Verify coupon exists in Stripe
		try {
			await stripe.coupons.retrieve(couponId);
		} catch (_error) {
			throw new Error(`Coupon ${couponId} not found in Stripe`);
		}

		// Get purchase record
		const purchase = await db.purchase.findUnique({
			where: { subscriptionId },
		});

		if (!purchase) {
			throw new Error("Purchase not found");
		}

		// Apply coupon to subscription in Stripe
		await stripe.subscriptions.update(subscriptionId, {
			coupon: couponId,
		} as any);

		const couponUser = purchase.userId
			? await db.user.findUnique({
					where: { id: purchase.userId },
					select: { email: true },
				})
			: null;

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "APPLY_COUPON",
			targetType: "subscription",
			targetId: subscriptionId,
			summary: `Applied coupon ${couponId} to subscription ${subscriptionId}${couponUser?.email ? ` (${couponUser.email})` : ""}`,
			metadata: {
				reason,
				couponId,
				userId: purchase.userId,
			},
		});

		return { success: true };
	});
