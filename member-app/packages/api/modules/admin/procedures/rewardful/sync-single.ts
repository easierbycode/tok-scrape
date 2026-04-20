import { db } from "@repo/database";
import { z } from "zod";
import {
	fetchRewardfulAffiliates,
	fetchRewardfulCommissions,
} from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

const SyncSingleInput = z.object({
	rewardfulId: z.string(),
});

export const syncSingleAffiliate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/rewardful/sync-single",
		tags: ["Administration"],
		summary: "Sync a single affiliate from Rewardful API",
	})
	.input(SyncSingleInput)
	.handler(async ({ input, context }) => {
		const { rewardfulId } = input;

		// Get affiliate from database
		const dbAffiliate = await db.affiliate.findUnique({
			where: { rewardfulId },
			include: {
				user: {
					select: { name: true },
				},
			},
		});

		if (!dbAffiliate) {
			throw new Error("Affiliate not found in database");
		}

		// Fetch from Rewardful
		const affiliates = await fetchRewardfulAffiliates();
		const rAffiliate = affiliates.find((a) => a.id === rewardfulId);

		if (!rAffiliate) {
			throw new Error("Affiliate not found in Rewardful");
		}

		// Fetch commissions
		const commissions = await fetchRewardfulCommissions(rewardfulId);

		// Calculate totals
		const totalEarnings = commissions.reduce((sum, c) => sum + c.amount, 0);
		const pendingEarnings = commissions
			.filter((c) => c.state === "pending")
			.reduce((sum, c) => sum + c.amount, 0);
		const paidEarnings = commissions
			.filter((c) => c.state === "paid")
			.reduce((sum, c) => sum + c.amount, 0);

		// Update database
		await db.affiliate.update({
			where: { id: dbAffiliate.id },
			data: {
				status:
					rAffiliate.state === "active"
						? "active"
						: rAffiliate.state === "suspended"
							? "suspended"
							: "inactive",
				visitors: rAffiliate.visitors,
				leads: rAffiliate.leads,
				conversions: rAffiliate.conversions,
				commissionsEarned: totalEarnings,
				commissionsPending: pendingEarnings,
				commissionsPaid: paidEarnings,
				lastSyncAt: new Date(),
				syncStatus: "synced",
				lastSyncError: null,
			},
		});

		return {
			success: true,
			affiliate: {
				rewardfulId,
				name: dbAffiliate.user?.name || rAffiliate.email,
				conversions: rAffiliate.conversions,
				earnings: totalEarnings / 100,
			},
		};
	});
