import { ORPCError } from "@orpc/server";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db, notifyAllAdmins } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { withTransaction } from "@repo/database/lib/transaction";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

/**
 * Revoke Manual Access Procedure
 *
 * Deletes the manual-override Purchase record to revoke access from a user.
 * Note: Discord role removal is manual admin action for MVP (not automated).
 */

const RevokeAccessInputSchema = z.object({
	userId: z.string().min(1),
	reason: z.string().optional(),
});

export const revokeAccess = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/revoke-access",
		tags: ["Administration"],
		summary: "Revoke manual subscription access from a user",
	})
	.input(RevokeAccessInputSchema)
	.handler(async ({ input, context }) => {
		const { userId, reason } = input;

		await withTransaction(async (tx) => {
			// Find manual-override purchase that's still active
			const purchase = await tx.purchase.findFirst({
				where: {
					userId,
					productId: MANUAL_OVERRIDE_PRODUCT_ID,
					status: { not: "cancelled" }, // Only find active purchases
				},
			});

			if (!purchase) {
				throw new ORPCError("NOT_FOUND", {
					message: "No active manual access found",
				});
			}

		// Update status instead of delete (preserve financial records)
		await tx.purchase.update({
			where: { id: purchase.id },
			data: {
				status: "cancelled",
				cancelledAt: new Date(),
				cancelAtPeriodEnd: false, // Immediate cancellation
			},
		});

		// Create notification for user
		await tx.notification.create({
			data: {
				userId,
				type: "warning",
				title: "Access Revoked",
				message: "Admin revoked your access.",
			},
		});
	});

	// Get user details for Discord removal (outside transaction)
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			discordId: true,
			discordUsername: true,
			discordConnected: true,
		},
	});

	// Remove from Discord if connected (outside transaction - external API call)
	if (user?.discordId && user.discordConnected) {
		const discordId: string = user.discordId;
		const { removeUserFromServer } = await import("@repo/discord");
		const kickResult = await removeUserFromServer(discordId);

		// Always clean up Discord state regardless of kick success —
		// access is revoked so DB should reflect that either way.
		await db.$transaction(async (tx) => {
			await tx.user.update({
				where: { id: userId },
				data: {
					discordConnected: false,
					discordConnectedAt: null,
				},
			});

			await tx.account.deleteMany({
				where: {
					userId,
					providerId: "discord",
				},
			});

			await tx.discordAudit.create({
				data: {
					userId,
					discordId,
					discordUsername: user.discordUsername,
					action: "kicked",
					reason: "access_revoked",
					performedBy: context.user.id,
					metadata: {
						kickSuccess: kickResult.success,
						kickError: kickResult.error ?? null,
					},
				},
			});
		});
	}

		const targetUser = await db.user.findUnique({
			where: { id: userId },
			select: { name: true, email: true },
		});

		// Log action (outside transaction)
		await logAdminAction({
			adminUserId: context.user.id,
			action: "REVOKE_ACCESS",
			targetType: "user",
			targetId: userId,
			summary: `Revoked manual access from ${targetUser?.email ?? userId}`,
			metadata: { reason },
		});

		// Notify all admins
		await notifyAllAdmins({
			type: "manual_access_revoked",
			title: "Manual Access Revoked",
			message: `${context.user.name} revoked access from ${targetUser?.name || targetUser?.email || "a user"}`,
		});

		return {
			success: true,
			message: "Manual access revoked successfully",
		};
	});
