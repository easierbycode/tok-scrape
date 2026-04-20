import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const applyCredit = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/apply-credit",
		tags: ["Administration"],
		summary: "Apply credit to customer",
	})
	.input(
		z.object({
			customerId: z.string(),
			amount: z.number().positive(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { customerId, amount, reason } = input;
		const stripe = getStripeClient();

		// Verify customer exists
		try {
			await stripe.customers.retrieve(customerId);
		} catch (_error) {
			throw new Error(`Customer ${customerId} not found in Stripe`);
		}

		// Get purchase record to find userId
		const purchase = await db.purchase.findFirst({
			where: { customerId },
			orderBy: { createdAt: "desc" },
		});

		// Create balance transaction (negative amount = credit)
		// Amount is in cents, so we multiply by 100
		await stripe.customers.createBalanceTransaction(customerId, {
			amount: -amount * 100, // Negative = credit
			currency: "usd",
			description: `Admin credit: ${reason}`,
		});

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "APPLY_CREDIT",
			targetType: "customer",
			targetId: customerId,
			summary: `Applied $${amount} account credit to Stripe customer ${customerId}`,
			metadata: {
				reason,
				amount,
				userId: purchase?.userId,
			},
		});

		return { success: true };
	});
