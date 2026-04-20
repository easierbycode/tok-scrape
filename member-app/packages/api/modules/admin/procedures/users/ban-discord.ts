import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { removeUserFromServer } from "@repo/discord";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const BanInputSchema = z.object({
	userId: z.string(),
	reason: z.string().min(1),
});

export const banUserFromDiscord = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/ban-discord",
		tags: ["Administration"],
		summary: "Ban user from reconnecting Discord (dashboard ban only)",
	})
	.input(BanInputSchema)
	.handler(async ({ input, context }) => {
		const { userId, reason } = input;

		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				discordId: true,
				discordConnected: true,
				discordBanned: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		if (user.discordBanned) {
			throw new ORPCError("CONFLICT", {
				message: "User is already Discord banned",
			});
		}

		// Kick from Discord if currently connected
		if (user.discordId && user.discordConnected) {
			const removeResult = await removeUserFromServer(user.discordId);
			if (!removeResult.success) {
				logger.warn("Failed to kick user during ban, but continuing", {
					userId,
					error: removeResult.error,
				});
			}
		}

		// Update user record
		await db.user.update({
			where: { id: userId },
			data: {
				discordBanned: true,
				discordBannedAt: new Date(),
				discordBannedBy: context.user.id,
				discordBanReason: reason,
				discordConnected: false,
			},
		});

		// Create audit log
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: userId,
			summary: `Discord dashboard ban applied to ${user.email}`,
			metadata: {
				action: "discord_banned",
				reason,
				discordId: user.discordId,
			},
		});

		await db.discordAudit.create({
			data: {
				userId,
				discordId: user.discordId || "",
				discordUsername: null,
				action: "banned",
				reason: "dashboard_ban",
				metadata: { reason, bannedBy: context.user.id },
			},
		});

		logger.info("User banned from Discord reconnection", {
			userId,
			email: user.email,
			adminId: context.user.id,
			reason,
		});

		return { success: true, message: "User banned from Discord" };
	});

export const unbanUserFromDiscord = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/unban-discord",
		tags: ["Administration"],
		summary: "Unban user from Discord reconnection",
	})
	.input(z.object({ userId: z.string() }))
	.handler(async ({ input, context }) => {
		const { userId } = input;

		const user = await db.user.findUnique({
			where: { id: userId },
			select: { id: true, email: true, discordBanned: true },
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		if (!user.discordBanned) {
			throw new ORPCError("BAD_REQUEST", {
				message: "User is not Discord banned",
			});
		}

		await db.user.update({
			where: { id: userId },
			data: {
				discordBanned: false,
				discordBannedAt: null,
				discordBannedBy: null,
				discordBanReason: null,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: userId,
			summary: `Removed Discord dashboard ban from ${user.email}`,
			metadata: { action: "discord_unbanned" },
		});

		logger.info("User unbanned from Discord", {
			userId,
			email: user.email,
			adminId: context.user.id,
		});

		return { success: true, message: "User unbanned from Discord" };
	});

