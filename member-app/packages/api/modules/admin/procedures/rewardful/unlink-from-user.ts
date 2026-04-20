import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const UnlinkFromUserInput = z.object({
	// Can unlink by either rewardfulId OR affiliateId (our database ID)
	rewardfulId: z.string().optional(),
	affiliateId: z.string().optional(),
});

export const unlinkFromUser = adminProcedure
	.route({
		method: "POST",
		path: "/admin/rewardful/unlink-from-user",
		tags: ["Administration"],
		summary: "Unlink affiliate from user (allows re-linking to different user)",
	})
	.input(UnlinkFromUserInput)
	.handler(async ({ input, context }) => {
		const { rewardfulId, affiliateId } = input;

		if (!rewardfulId && !affiliateId) {
			throw new Error("Must provide either rewardfulId or affiliateId");
		}

		// Find the affiliate record
		const affiliate = await db.affiliate.findFirst({
			where: rewardfulId ? { rewardfulId } : { id: affiliateId },
			include: { user: true },
		});

		if (!affiliate) {
			throw new Error("Affiliate record not found in database");
		}

		// Store info for logging before deletion
		const unlinkInfo = {
			affiliateId: affiliate.id,
			rewardfulId: affiliate.rewardfulId,
			userId: affiliate.userId,
			userEmail: affiliate.user.email,
			userName: affiliate.user.name,
			slug: affiliate.slug,
		};

		// Delete the affiliate record from our database
		// NOTE: This does NOT delete the affiliate from Rewardful - it just unlinks
		await db.affiliate.delete({
			where: { id: affiliate.id },
		});

		logger.info("Admin unlinked affiliate from user", {
			...unlinkInfo,
			adminId: context.user.id,
			adminEmail: context.user.email,
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "UNLINK_AFFILIATE",
			targetType: "affiliate",
			targetId: unlinkInfo.affiliateId,
			summary: `Unlinked affiliate ${unlinkInfo.slug} from ${unlinkInfo.userEmail}`,
			metadata: unlinkInfo,
		});

		return {
			success: true,
			message: `Unlinked affiliate "${affiliate.slug}" from user ${affiliate.user.email}. The Rewardful account still exists and can be linked to a different user.`,
			unlinkedAffiliate: unlinkInfo,
		};
	});
