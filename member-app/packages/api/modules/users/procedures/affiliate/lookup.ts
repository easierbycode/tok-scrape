import { db } from "@repo/database";
import { findRewardfulAffiliateByEmail } from "../../../../lib/rewardful-client";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";
import { z } from "zod";

export const lookupAffiliate = protectedProcedure
	.use(rateLimitMiddleware({ limit: 5, windowMs: 60000 }))
	.input(z.object({ email: z.string().email() }))
	.handler(async ({ input, context }) => {
		if (input.email.toLowerCase() !== context.user.email.toLowerCase()) {
			return {
				found: false,
				affiliateFirstName: undefined,
				alreadyLinked: false,
			};
		}

		const existingInDb = await db.affiliate.findUnique({
			where: { userId: context.user.id },
		});

		if (existingInDb) {
			throw new Error("Already enrolled as affiliate");
		}

		const existingRewardfulAffiliate = await findRewardfulAffiliateByEmail(
			input.email,
		);

		if (!existingRewardfulAffiliate) {
			return {
				found: false,
				affiliateFirstName: undefined,
				alreadyLinked: false,
			};
		}

		// Check if this Rewardful account is already linked to another user
		const alreadyLinked = await db.affiliate.findUnique({
			where: { rewardfulId: existingRewardfulAffiliate.id },
		});

		return {
			found: true,
			affiliateFirstName: existingRewardfulAffiliate.first_name ?? undefined,
			alreadyLinked: !!alreadyLinked,
		};
	});
