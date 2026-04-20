import { ORPCError } from "@orpc/server";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { removeUserFromServer } from "@repo/discord";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const kickDiscordUser = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/kick-user",
		tags: ["Administration"],
		summary: "Kick a user from the Discord server by Discord ID",
	})
	.input(
		z.object({
			discordId: z.string().min(1),
			username: z.string().optional(),
			reason: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		if (!process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					"DISCORD_GUILD_ID or DISCORD_BOT_TOKEN is not configured",
			});
		}

		const kick = await removeUserFromServer(
			input.discordId,
			input.reason ?? "Admin kick via sync health check",
		);

		if (!kick.success) {
			const err = kick.error ?? "Unknown error";
			logger.error("Failed to kick Discord user", {
				discordId: input.discordId,
				error: err,
			});

			if (err.includes("(403)")) {
				throw new ORPCError("FORBIDDEN", {
					message: "Bot lacks permission to kick members",
				});
			}

			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: err,
			});
		}

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.discordId,
			summary: `Kicked unregistered Discord member ${input.username} (${input.discordId})`,
			metadata: {
				action: "kicked_unregistered_user",
				discordId: input.discordId,
				username: input.username,
				reason: input.reason ?? "Admin action via sync health check",
			},
		});

		logger.info("Kicked unregistered Discord user", {
			discordId: input.discordId,
			username: input.username,
			adminId: context.user.id,
		});

		return { success: true };
	});
