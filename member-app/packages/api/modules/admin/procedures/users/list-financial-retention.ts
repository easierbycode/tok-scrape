import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const listFinancialRetention = adminProcedure
	.route({
		method: "GET",
		path: "/admin/users/financial-retention",
		tags: ["Administration"],
		summary: "List anonymized users with retained financial records",
		description:
			"Returns users whose PII has been anonymized but whose purchase records are retained for financial/legal compliance (7-year EU requirement)",
	})
	.input(z.object({}).optional())
	.handler(async () => {
		// Users who are deleted AND anonymized (email contains @deleted.local)
		// AND still have purchases with active financial retention
		const users = await db.user.findMany({
			where: {
				deletedAt: { not: null },
				email: { contains: "@deleted.local" },
			},
			select: {
				id: true,
				name: true,
				email: true,
				deletedAt: true,
				deletedBy: true,
				deletionReason: true,
				dataRetentionUntil: true,
				purchases: {
					select: {
						id: true,
						type: true,
						status: true,
						customerId: true,
						subscriptionId: true,
						productId: true,
						createdAt: true,
						cachedAmount: true,
						cachedInterval: true,
						cachedCouponName: true,
						cachedDiscountPercent: true,
						financialRetentionUntil: true,
					},
					orderBy: { createdAt: "desc" },
				},
			},
			orderBy: { deletedAt: "desc" },
		});

		const now = new Date();

		return users.map((u) => {
			const totalRevenue = u.purchases.reduce(
				(sum, p) => sum + (p.cachedAmount || 0),
				0,
			);

			const retentionExpiry = u.dataRetentionUntil;
			const daysUntilExpiry = retentionExpiry
				? Math.ceil(
						(retentionExpiry.getTime() - now.getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: null;

			return {
				...u,
				totalRevenue,
				purchaseCount: u.purchases.length,
				daysUntilExpiry,
			};
		});
	});
