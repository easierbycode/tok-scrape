import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { checkAndGrantDiscordAccess } from "../../../../lib/discord-helper";
import { adminProcedure } from "../../../../orpc/procedures";

export const syncDiscordRole = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/sync-role",
		tags: ["Administration"],
		summary: "Re-sync a user's Discord role based on their current subscription status",
	})
	.input(
		z.object({
			userId: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		const user = await db.user.findUnique({
			where: { id: input.userId },
			select: {
				id: true,
				email: true,
				discordId: true,
				discordConnected: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		if (!user.discordId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "User does not have a Discord account linked",
			});
		}

		const result = await checkAndGrantDiscordAccess(input.userId);

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: input.userId,
			summary: `Manually synced Discord role for ${user.email}`,
			metadata: {
				action: "sync_discord_role",
				discordId: user.discordId,
				success: result.success,
				error: result.error ?? null,
			},
		});

		if (!result.success) {
			logger.warn("Discord role sync failed", {
				userId: input.userId,
				error: result.error,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error ?? "Failed to sync Discord role",
			});
		}

		logger.info("Discord role synced by admin", {
			userId: input.userId,
			adminId: context.user.id,
		});

		return { success: true };
	});
