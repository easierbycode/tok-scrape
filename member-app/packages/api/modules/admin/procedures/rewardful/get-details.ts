import { z } from "zod";
import {
	fetchRewardfulAffiliateDetails,
	fetchRewardfulCommissionsWithSale,
} from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

const GetAffiliateDetailsInput = z.object({
	affiliateId: z.string(),
});

export const getAffiliateDetails = adminProcedure
	.route({
		method: "GET",
		path: "/admin/rewardful/affiliate/:affiliateId",
		tags: ["Administration"],
		summary: "Get detailed affiliate data from Rewardful",
	})
	.input(GetAffiliateDetailsInput)
	.handler(async ({ input }) => {
		const { affiliateId } = input;

		// Fetch affiliate details (for links) and commissions (with sale expansion) in parallel
		const [details, commissions] = await Promise.all([
			fetchRewardfulAffiliateDetails(affiliateId),
			fetchRewardfulCommissionsWithSale(affiliateId, 5),
		]);

		const links = (details.links ?? []).map((link) => ({
			token: link.token,
			visitors: link.visitors,
			conversions: link.conversions,
		}));

		const recentConversions = commissions
			.filter((c) => c.state !== "voided")
			.map((c) => ({
				customerName: c.sale?.referral?.customer?.name ?? "Unknown",
				date: c.sale?.charged_at ?? null,
				saleAmountCents: c.sale?.sale_amount_cents ?? 0,
				commissionAmountCents: c.amount,
				state: c.state,
			}));

		return { links, recentConversions };
	});
