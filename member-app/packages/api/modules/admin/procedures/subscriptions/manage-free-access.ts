import { ORPCError } from "@orpc/server";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { withTransaction } from "@repo/database/lib/transaction";
import { z } from "zod";
import { checkAndGrantDiscordAccess } from "../../../../lib/discord-helper";
import { adminProcedure } from "../../../../orpc/procedures";

export const manageFreeAccess = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/manage-free-access",
		tags: ["Administration"],
		summary: "Manage free access (extend or convert)",
	})
	.input(
		z.object({
			userId: z.string(),
			action: z.enum(["extend", "convert"]),
			months: z.number().int().positive().optional(),
			reason: z.string().min(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, action, reason } = input;

		const freeAccessUser = await db.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (action === "extend") {
			// Extend manual access - same as grant-access
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
						title: "Access Extended",
						message:
							"Admin extended your free access to LifePreneur.",
					},
				});
			});

			// Log action
			await logAdminAction({
				adminUserId: context.user.id,
				action: "GRANT_ACCESS",
				targetType: "user",
				targetId: userId,
				summary: `Extended free access for ${freeAccessUser?.email ?? userId}`,
				metadata: { reason, action: "extend_free_access" },
			});

			// Grant Discord access
			await checkAndGrantDiscordAccess(userId);
		} else if (action === "convert") {
			// Convert free access to paid subscription
			// This would require creating a Stripe subscription
			// For now, we'll just remove the manual override
			await db.purchase.deleteMany({
				where: {
					userId,
					productId: MANUAL_OVERRIDE_PRODUCT_ID,
				},
			});

			// Log action
			await logAdminAction({
				adminUserId: context.user.id,
				action: "REVOKE_ACCESS",
				targetType: "user",
				targetId: userId,
				summary: `Removed free access (convert flow) for ${freeAccessUser?.email ?? userId}`,
				metadata: { reason, action: "convert_free_access" },
			});
		}

		return { success: true };
	});
