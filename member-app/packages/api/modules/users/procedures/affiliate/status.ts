import { db } from "@repo/database";
import { protectedProcedure } from "../../../../orpc/procedures";

export const getAffiliateStatus = protectedProcedure.handler(
	async ({ context }) => {
		const affiliate = await db.affiliate.findUnique({
			where: { userId: context.user.id },
		});

		if (!affiliate) {
			return { hasAffiliate: false };
		}

		return {
			hasAffiliate: true,
			affiliate: {
				slug: affiliate.slug,
				primaryLinkUrl: affiliate.primaryLinkUrl,
				status: affiliate.status,
				rewardfulId: affiliate.rewardfulId,
				visitors: affiliate.visitors,
				conversions: affiliate.conversions,
				commissionsEarned: affiliate.commissionsEarned,
				commissionsPending: affiliate.commissionsPending,
				commissionsPaid: affiliate.commissionsPaid,
				lastSyncAt: affiliate.lastSyncAt?.toISOString() ?? null,
			},
		};
	},
);
