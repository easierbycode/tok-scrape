import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import {
	fetchRewardfulAffiliateDetails,
	fetchRewardfulCommissions,
} from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

const VerifyInput = z.object({
	rewardfulId: z.string(),
});

export const verifyAffiliate = adminProcedure
	.route({
		method: "GET",
		path: "/admin/rewardful/verify/:rewardfulId",
		tags: ["Administration"],
		summary: "Verify affiliate data against Rewardful API",
	})
	.input(VerifyInput)
	.handler(async ({ input, context }) => {
		const { rewardfulId } = input;

		logger.info("Verifying affiliate data", {
			rewardfulId,
			requestId: context.requestId,
		});

		// Get from DB
		const dbAffiliate = await db.affiliate.findUnique({
			where: { rewardfulId },
			include: {
				user: {
					select: { name: true, email: true },
				},
			},
		});

		if (!dbAffiliate) {
			throw new Error("Affiliate not found in database");
		}

		// Fetch fresh from Rewardful (2 API calls)
		const [details, commissions] = await Promise.all([
			fetchRewardfulAffiliateDetails(rewardfulId),
			fetchRewardfulCommissions(rewardfulId),
		]);

		// Calculate Rewardful totals
		const rewardfulTotals = {
			visitors: details.visitors,
			leads: details.leads,
			conversions: details.conversions,
			totalEarnings: commissions.reduce((sum, c) => sum + c.amount, 0),
			pendingEarnings: commissions
				.filter((c) => c.state === "pending")
				.reduce((sum, c) => sum + c.amount, 0),
			paidEarnings: commissions
				.filter((c) => c.state === "paid")
				.reduce((sum, c) => sum + c.amount, 0),
		};

		// Compare with DB
		const comparison = {
			visitors: {
				db: dbAffiliate.visitors,
				rewardful: rewardfulTotals.visitors,
				match: dbAffiliate.visitors === rewardfulTotals.visitors,
				diff: dbAffiliate.visitors - rewardfulTotals.visitors,
			},
			leads: {
				db: dbAffiliate.leads,
				rewardful: rewardfulTotals.leads,
				match: dbAffiliate.leads === rewardfulTotals.leads,
				diff: dbAffiliate.leads - rewardfulTotals.leads,
			},
			conversions: {
				db: dbAffiliate.conversions,
				rewardful: rewardfulTotals.conversions,
				match: dbAffiliate.conversions === rewardfulTotals.conversions,
				diff: dbAffiliate.conversions - rewardfulTotals.conversions,
			},
			totalEarnings: {
				db: dbAffiliate.commissionsEarned / 100,
				rewardful: rewardfulTotals.totalEarnings / 100,
				match:
					Math.abs(
						dbAffiliate.commissionsEarned -
							rewardfulTotals.totalEarnings,
					) < 1, // Allow 1 cent difference
				diff:
					(dbAffiliate.commissionsEarned -
						rewardfulTotals.totalEarnings) /
					100,
			},
			pendingEarnings: {
				db: dbAffiliate.commissionsPending / 100,
				rewardful: rewardfulTotals.pendingEarnings / 100,
				match:
					Math.abs(
						dbAffiliate.commissionsPending -
							rewardfulTotals.pendingEarnings,
					) < 1,
				diff:
					(dbAffiliate.commissionsPending -
						rewardfulTotals.pendingEarnings) /
					100,
			},
			paidEarnings: {
				db: dbAffiliate.commissionsPaid / 100,
				rewardful: rewardfulTotals.paidEarnings / 100,
				match:
					Math.abs(
						dbAffiliate.commissionsPaid -
							rewardfulTotals.paidEarnings,
					) < 1,
				diff:
					(dbAffiliate.commissionsPaid -
						rewardfulTotals.paidEarnings) /
					100,
			},
		};

		const allMatch = Object.values(comparison).every((c) => c.match);

		return {
			affiliate: {
				id: dbAffiliate.id,
				name: dbAffiliate.user?.name || "N/A",
				email: dbAffiliate.user?.email || "N/A",
				rewardfulId: dbAffiliate.rewardfulId,
			},
			comparison,
			lastSynced: dbAffiliate.lastSyncAt?.toISOString() || null,
			syncStatus: dbAffiliate.syncStatus,
			allMatch,
			summary: allMatch
				? "All data matches Rewardful"
				: "Data discrepancies found - see comparison details",
		};
	});
