import { db } from "@repo/database";
import { logger } from "@repo/logs";
import {
	fetchRewardfulAffiliateDetails,
	fetchRewardfulCommissions,
} from "../../../../lib/rewardful-client";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";

const ONE_HOUR_MS = 60 * 60 * 1000;

export const refreshAffiliateStats = protectedProcedure
	.use(rateLimitMiddleware({ limit: 10, windowMs: 60_000 }))
	.handler(async ({ context }) => {
		const affiliate = await db.affiliate.findUnique({
			where: { userId: context.user.id },
		});

		if (!affiliate) {
			throw new Error("No affiliate found for this user");
		}

		if (!affiliate.rewardfulId || affiliate.rewardfulId.startsWith("temp-")) {
			throw new Error(
				"Affiliate not properly synced with Rewardful. Please contact support.",
			);
		}

		const now = new Date();

		// Return cached DB data if last sync was within the hour
		if (
			affiliate.lastSyncAt &&
			now.getTime() - affiliate.lastSyncAt.getTime() < ONE_HOUR_MS
		) {
			return {
				fromCache: true,
				visitors: affiliate.visitors,
				conversions: affiliate.conversions,
				commissionsEarned: affiliate.commissionsEarned,
				commissionsPending: affiliate.commissionsPending,
				commissionsPaid: affiliate.commissionsPaid,
				primaryLinkUrl: affiliate.primaryLinkUrl,
				lastSyncAt: affiliate.lastSyncAt.toISOString(),
			};
		}

		// Fetch fresh data from Rewardful in parallel
		const [rAffiliate, commissions] = await Promise.all([
			fetchRewardfulAffiliateDetails(affiliate.rewardfulId),
			fetchRewardfulCommissions(affiliate.rewardfulId),
		]);

		// If the stored primaryLinkUrl is no longer in Rewardful (edited/deleted),
		// update it to the oldest available link (original signup link)
		const links = rAffiliate.links ?? [];
		let updatedPrimaryLinkUrl = affiliate.primaryLinkUrl;

		if (links.length > 0) {
			const linkUrls = links.map((l) => l.url);
			if (
				!affiliate.primaryLinkUrl ||
				!linkUrls.includes(affiliate.primaryLinkUrl)
			) {
				const sorted = [...links].sort(
					(a, b) =>
						new Date(a.created_at).getTime() -
						new Date(b.created_at).getTime(),
				);
				updatedPrimaryLinkUrl = sorted[0].url;
				logger.info("Updated primary affiliate link URL during stats sync", {
					userId: context.user.id,
					oldUrl: affiliate.primaryLinkUrl,
					newUrl: updatedPrimaryLinkUrl,
				});
			}
		}

		// Use the primary link's visitors count; fall back to affiliate aggregate
		// if the link can't be matched (e.g. URL just changed before next sync cycle)
		const matchedLink = links.find((l) => l.url === updatedPrimaryLinkUrl);
		const primaryLinkVisitors = matchedLink?.visitors ?? rAffiliate.visitors;

		// Calculate commission totals (consistent with admin sync logic)
		const commissionsEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
		const commissionsPending = commissions
			.filter((c) => c.state === "pending")
			.reduce((sum, c) => sum + c.amount, 0);
		const commissionsPaid = commissions
			.filter((c) => c.state === "paid")
			.reduce((sum, c) => sum + c.amount, 0);

		await db.affiliate.update({
			where: { id: affiliate.id },
			data: {
				visitors: primaryLinkVisitors,
				leads: rAffiliate.leads,
				conversions: rAffiliate.conversions,
				commissionsEarned,
				commissionsPending,
				commissionsPaid,
				primaryLinkUrl: updatedPrimaryLinkUrl,
				lastSyncAt: now,
				syncStatus: "synced",
				lastSyncError: null,
			},
		});

		logger.info("Refreshed affiliate stats from Rewardful", {
			userId: context.user.id,
			primaryLinkVisitors,
			usedAggregateFallback: !matchedLink,
			conversions: rAffiliate.conversions,
			commissionsEarned,
		});

		return {
			fromCache: false,
			visitors: primaryLinkVisitors,
			conversions: rAffiliate.conversions,
			commissionsEarned,
			commissionsPending,
			commissionsPaid,
			primaryLinkUrl: updatedPrimaryLinkUrl,
			lastSyncAt: now.toISOString(),
		};
	});
