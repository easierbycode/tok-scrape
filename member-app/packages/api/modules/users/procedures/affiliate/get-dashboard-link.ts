import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getRewardfulSSOLink } from "../../../../lib/rewardful-client";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";

export const getDashboardLink = protectedProcedure
	.use(rateLimitMiddleware({ limit: 5, windowMs: 60_000 }))
	.handler(
	async ({ context }) => {
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
			// Generate fresh SSO link (expires in 1 minute)
			const ssoLink = await getRewardfulSSOLink(affiliate.rewardfulId);

			logger.info("Generated affiliate dashboard SSO link", {
				userId: context.user.id,
				affiliateId: affiliate.id,
				expires: ssoLink.expires,
			});

			return {
				url: ssoLink.url,
				expires: ssoLink.expires,
			};
		} catch (error: any) {
			logger.error("Failed to generate dashboard link", {
				userId: context.user.id,
				affiliateId: affiliate.id,
				rewardfulId: affiliate.rewardfulId,
				error: error.message,
			});

			throw new Error(
				"Failed to generate dashboard link. Please try again.",
			);
		}
	},
);

