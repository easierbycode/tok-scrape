import { ORPCError } from "@orpc/client";
import { db, updatePurchase } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const BackfillAttributionInput = z.object({
	items: z.array(
		z.object({
			userId: z.string(),
			referralId: z.string(),
			affiliateToken: z.string(),
		}),
	),
});

export const backfillAttribution = adminProcedure
	.route({
		method: "POST",
		path: "/admin/rewardful/backfill-attribution",
		tags: ["Administration"],
		summary:
			"Backfill User and Purchase referral fields from Rewardful data",
	})
	.input(BackfillAttributionInput)
	.handler(async ({ input, context }) => {
		const { items } = input;

		if (items.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Select at least one row",
			});
		}

		let updatedUsers = 0;
		let updatedPurchases = 0;
		const errors: string[] = [];

		for (const item of items) {
			try {
				const user = await db.user.findUnique({
					where: { id: item.userId },
					select: { id: true },
				});
				if (!user) {
					errors.push(`User not found: ${item.userId}`);
					continue;
				}

				await db.user.update({
					where: { id: item.userId },
					data: {
						referredBy: item.referralId,
						referredBySlug: item.affiliateToken,
						referralSource: "rewardful",
					},
				});
				updatedUsers++;

				const purchases = await db.purchase.findMany({
					where: {
						userId: item.userId,
						deletedAt: null,
					},
					select: { id: true },
				});

				for (const p of purchases) {
					await updatePurchase({
						id: p.id,
						rewardfulReferralId: item.referralId,
						referralCode: item.affiliateToken,
					});
					updatedPurchases++;
				}
			} catch (error) {
				const msg =
					error instanceof Error ? error.message : String(error);
				logger.error("Backfill attribution row failed", {
					userId: item.userId,
					error: msg,
				});
				errors.push(`${item.userId}: ${msg}`);
			}
		}

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: "referral-backfill",
			summary: `Referral attribution backfill: ${updatedUsers} users, ${updatedPurchases} purchases`,
			metadata: {
				action: "BACKFILL_REFERRAL_ATTRIBUTION",
				updatedUsers,
				updatedPurchases,
				errors: errors.length,
			},
		});

		return {
			success: errors.length === 0,
			updatedUsers,
			updatedPurchases,
			errors,
		};
	});
