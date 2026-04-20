import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { fetchRewardfulAffiliateDetails } from "../../../../lib/rewardful-client";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";

export const refreshAffiliateLink = protectedProcedure
	.use(rateLimitMiddleware({ limit: 3, windowMs: 60000 }))
	.handler(async ({ context }) => {
		const affiliate = await db.affiliate.findUnique({
			where: { userId: context.user.id },
		});

		if (!affiliate) {
			throw new Error("Not enrolled as affiliate");
		}

		if (!affiliate.rewardfulId || affiliate.rewardfulId.startsWith("temp-")) {
			throw new Error(
				"Affiliate not properly synced with Rewardful. Please contact support.",
			);
		}

		try {
			const details = await fetchRewardfulAffiliateDetails(
				affiliate.rewardfulId,
			);

			const primaryLinkUrl = details.links?.[0]?.url || null;

			if (!primaryLinkUrl) {
				logger.warn("No links found in Rewardful for affiliate", {
					userId: context.user.id,
					rewardfulId: affiliate.rewardfulId,
				});
				throw new Error(
					"No affiliate links found in Rewardful. Please create one in the Rewardful dashboard.",
				);
			}

			await db.affiliate.update({
				where: { id: affiliate.id },
				data: { primaryLinkUrl },
			});

			logger.info("Refreshed affiliate primary link URL", {
				userId: context.user.id,
				affiliateId: affiliate.id,
				primaryLinkUrl,
			});

			return { primaryLinkUrl };
		} catch (error: any) {
			logger.error("Failed to refresh affiliate link", {
				userId: context.user.id,
				rewardfulId: affiliate.rewardfulId,
				error: error.message,
			});

			throw new Error(
				error.message.includes("No affiliate links")
					? error.message
					: "Failed to retrieve your link from Rewardful. Please try the Rewardful dashboard directly.",
			);
		}
	});
