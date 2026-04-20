import { type Config, config } from "@repo/config";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

function isConfiguredStripePriceId(priceId: string): boolean {
	const plans = config.payments.plans as Config["payments"]["plans"];
	for (const plan of Object.values(plans)) {
		if (!plan || !("prices" in plan) || !plan.prices) {
			continue;
		}
		if (
			plan.prices.some((p) => "productId" in p && p.productId === priceId)
		) {
			return true;
		}
	}
	return false;
}

export const changePlan = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/change-plan",
		tags: ["Administration"],
		summary: "Change subscription plan",
	})
	.input(
		z.object({
			subscriptionId: z.string(),
			newPriceId: z.string(),
			prorate: z.boolean(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { subscriptionId, newPriceId, prorate, reason } = input;
		const stripe = getStripeClient();

		if (!isConfiguredStripePriceId(newPriceId)) {
			throw new Error("Invalid price id — not defined in app config");
		}

		// Get current subscription to find the subscription item
		const subscription =
			await stripe.subscriptions.retrieve(subscriptionId);
		const subscriptionItemId = subscription.items.data[0]?.id;

		if (!subscriptionItemId) {
			throw new Error("Subscription has no items");
		}

		// Update subscription with new price
		await stripe.subscriptions.update(subscriptionId, {
			items: [
				{
					id: subscriptionItemId,
					price: newPriceId,
				},
			],
			proration_behavior: prorate ? "always_invoice" : "none",
		});

		// Update database
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				productId: newPriceId,
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
			action: "CHANGE_PLAN",
			targetType: "subscription",
			targetId: subscriptionId,
			summary: `Changed plan (price ${newPriceId}) for ${purchase?.user?.email ?? subscriptionId}`,
			metadata: {
				reason,
				newPriceId,
				prorate,
				userId: purchase?.userId,
			},
		});

		return { success: true };
	});
