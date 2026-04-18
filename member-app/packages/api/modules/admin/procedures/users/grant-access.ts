import { ORPCError } from "@orpc/server";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db, notifyAllAdmins } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { withTransaction } from "@repo/database/lib/transaction";
import { z } from "zod";
import { checkAndGrantDiscordAccess } from "../../../../lib/discord-helper";
import { adminProcedure } from "../../../../orpc/procedures";

/**
 * Grant Manual Access Procedure
 *
 * Creates a manual-override Purchase record to grant access to a user.
 * Also grants Discord role if user has Discord connected.
 */

const GrantAccessInputSchema = z.object({
	userId: z.string().min(1),
	reason: z.string().optional(),
});

export const grantAccess = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/grant-access",
		tags: ["Administration"],
		summary: "Grant manual subscription access to a user",
	})
	.input(GrantAccessInputSchema)
	.handler(async ({ input, context }) => {
		const { userId, reason } = input;

		await withTransaction(async (tx) => {
			// Check if user already has manual-override
			const existing = await tx.purchase.findFirst({
				where: {
					userId,
					productId: MANUAL_OVERRIDE_PRODUCT_ID,
				},
			});

			if (existing) {
				throw new ORPCError("CONFLICT", {
					message: "User already has manual access",
				});
			}

			// Create manual-override purchase
			await tx.purchase.create({
				data: {
					type: "ONE_TIME",
					customerId: `manual-${userId}`,
					productId: MANUAL_OVERRIDE_PRODUCT_ID,
					status: "active",
					subscriptionId: null,
					userId,
				},
			});

			// Create notification for user
			await tx.notification.create({
				data: {
					userId,
					type: "success",
					title: "Access Granted",
					message: "Admin granted you access to LifePreneur.",
				},
			});
		});

		const targetUser = await db.user.findUnique({
			where: { id: userId },
			select: { name: true, email: true },
		});

		// Log action (outside transaction)
		await logAdminAction({
			adminUserId: context.user.id,
			action: "GRANT_ACCESS",
			targetType: "user",
			targetId: userId,
			summary: `Granted manual access to ${targetUser?.email ?? userId}`,
			metadata: { reason },
		});

		// Grant Discord access (outside transaction)
		await checkAndGrantDiscordAccess(userId);

		// Notify all admins
		await notifyAllAdmins({
			type: "manual_access_granted",
			title: "Manual Access Granted",
			message: `${context.user.name} granted access to ${targetUser?.name || targetUser?.email || "a user"}`,
		});

		return {
			success: true,
			message: "Manual access granted successfully",
		};
	});
