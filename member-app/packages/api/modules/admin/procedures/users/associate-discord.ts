import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const associateDiscordAccount = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/associate-discord",
		tags: ["Administration"],
		summary: "Manually associate a Discord account with a platform user",
	})
	.input(
		z.object({
			userId: z.string().min(1),
			discordId: z.string().min(1),
			discordUsername: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, discordId, discordUsername } = input;

		const user = await db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				discordId: true,
				discordConnected: true,
			},
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		// Check if this Discord ID is already linked to someone else
		const existingOwner = await db.user.findFirst({
			where: {
				discordId,
				id: { not: userId },
			},
			select: { id: true, email: true },
		});

		if (existingOwner) {
			throw new ORPCError("CONFLICT", {
				message: `This Discord ID is already linked to ${existingOwner.email}`,
			});
		}

		await db.user.update({
			where: { id: userId },
			data: {
				discordId,
				discordUsername: discordUsername ?? null,
				discordConnected: true,
				discordConnectedAt: new Date(),
			},
		});

		await db.discordAudit.create({
			data: {
				userId: user.id,
				discordId,
				discordUsername: discordUsername ?? null,
				action: "connected",
				reason: "admin_manual_association",
				performedBy: context.user.id,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: userId,
			summary: `Associated Discord account ${discordUsername ?? discordId} with ${user.email}`,
			metadata: {
				action: "associate_discord_account",
				discordId,
				discordUsername,
				previousDiscordId: user.discordId,
			},
		});

		return { success: true };
	});
