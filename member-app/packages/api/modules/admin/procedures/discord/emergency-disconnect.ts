import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { removeUserFromServer } from "@repo/discord";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const EmergencyDisconnectSchema = z.object({
	reason: z.string().min(10),
	confirmationText: z.string().refine((val) => val === "DISCONNECT ALL USERS", {
		message: "Must type 'DISCONNECT ALL USERS' to confirm",
	}),
});

export const emergencyDisconnectAll = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/emergency-disconnect-all",
		tags: ["Administration"],
		summary: "Emergency disconnect all users from Discord (SUPER ADMIN ONLY)",
	})
	.input(EmergencyDisconnectSchema)
	.handler(async ({ input, context }) => {
		const { reason } = input;

		// Super admin check - configure this based on your admin system
		const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "").split(",");
		const adminUser = await db.user.findUnique({
			where: { id: context.user.id },
			select: { email: true },
		});

		if (!adminUser || !superAdminEmails.includes(adminUser.email)) {
			throw new ORPCError("FORBIDDEN", {
				message: "This operation requires super admin privileges",
			});
		}

		logger.warn("EMERGENCY: Disconnect all initiated", {
			adminId: context.user.id,
			adminEmail: adminUser.email,
			reason,
		});

		// Get all connected users
		const connectedUsers = await db.user.findMany({
			where: {
				discordConnected: true,
				discordId: { not: null },
			},
			select: {
				id: true,
				discordId: true,
				email: true,
			},
		});

		let successCount = 0;
		let failCount = 0;
		const errors = [];

		// Disconnect each user
		for (const user of connectedUsers) {
			try {
				if (!user.discordId) continue;

				// Kick from server
				const removeResult = await removeUserFromServer(user.discordId);

				if (removeResult.success) {
					// Update database
					await db.user.update({
						where: { id: user.id },
						data: {
							discordConnected: false,
						},
					});

					// Create audit log
					await db.discordAudit.create({
						data: {
							userId: user.id,
							discordId: user.discordId,
							discordUsername: null,
							action: "disconnected",
							reason: "emergency_disconnect_all",
							metadata: {
								reason,
								adminId: context.user.id,
								adminEmail: adminUser.email,
							},
						},
					});

					successCount++;
				} else {
					failCount++;
					errors.push({
						userId: user.id,
						email: user.email,
						error: removeResult.error,
					});
				}

				// Rate limit to avoid Discord API throttling
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				failCount++;
				errors.push({
					userId: user.id,
					email: user.email,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		// Log admin action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: "all",
			summary: `Emergency Discord disconnect: ${successCount} succeeded, ${failCount} failed (${connectedUsers.length} users)`,
			metadata: {
				action: "emergency_disconnect_all",
				reason,
				totalUsers: connectedUsers.length,
				successCount,
				failCount,
				errors: errors.slice(0, 10), // First 10 errors only
			},
		});

		// Notify all admins
		const { notifyAllAdmins } = await import("@repo/database");
		await notifyAllAdmins({
			type: "emergency_action",
			title: "EMERGENCY: All Discord Users Disconnected",
			message: `${adminUser.email} disconnected all users from Discord.

Reason: ${reason}
Total Users: ${connectedUsers.length}
Successful: ${successCount}
Failed: ${failCount}

View audit logs: /admin/discord/audit-logs`,
		});

		logger.warn("EMERGENCY: Disconnect all completed", {
			totalUsers: connectedUsers.length,
			successCount,
			failCount,
		});

		return {
			success: true,
			summary: {
				totalUsers: connectedUsers.length,
				successCount,
				failCount,
				errors: errors.slice(0, 10),
			},
		};
	});

