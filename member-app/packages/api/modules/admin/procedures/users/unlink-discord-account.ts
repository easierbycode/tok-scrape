import { ORPCError } from "@orpc/server";
import { db, notifyAllAdmins } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { removeUserFromServer } from "@repo/discord";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const UnlinkDiscordAccountInputSchema = z.object({
	userId: z.string().min(1),
	reason: z.string().optional(),
});

export const unlinkDiscordAccount = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/unlink-discord-account",
		tags: ["Administration"],
		summary:
			"Fully unlink a Discord account from a user, clearing all Discord data and removing the OAuth link",
	})
	.input(UnlinkDiscordAccountInputSchema)
	.handler(async ({ input, context }) => {
		const { userId, reason } = input;

		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				discordId: true,
				discordUsername: true,
				discordConnected: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		if (!user.discordId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "User does not have a linked Discord account",
			});
		}

		if (user.discordConnected) {
			const kickResult = await removeUserFromServer(user.discordId);
			if (!kickResult.success) {
				logger.warn(
					"Discord kick failed during admin unlink — OAuth and DB were still cleared; fix Discord/bot permissions or token",
					{
						userId,
						discordId: user.discordId,
						error: kickResult.error,
					},
				);
			}
		}

		await db.user.update({
			where: { id: userId },
			data: {
				discordId: null,
				discordUsername: null,
				discordConnected: false,
				discordConnectedAt: null,
			},
		});

		await db.account.deleteMany({
			where: {
				userId,
				providerId: "discord",
			},
		});

		await db.discordAudit.create({
			data: {
				userId: user.id,
				discordId: user.discordId,
				discordUsername: user.discordUsername,
				action: "disconnected",
				reason: reason || "admin_unlinked_account",
				performedBy: context.user.id,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: userId,
			summary: `Unlinked Discord from ${user.email}`,
			metadata: {
				action: "unlink_discord_account",
				previousDiscordId: user.discordId,
				previousDiscordUsername: user.discordUsername,
				reason,
			},
		});

		await notifyAllAdmins({
			type: "discord_account_unlinked",
			title: "Discord Account Unlinked",
			message: `${context.user.name} unlinked Discord account from ${user.name} (${user.email}).
Previous Discord: ${user.discordUsername} (ID: ${user.discordId})
Reason: ${reason || "Not specified"}`,
		});

		return {
			success: true,
			message: "Discord account unlinked successfully",
		};
	});
