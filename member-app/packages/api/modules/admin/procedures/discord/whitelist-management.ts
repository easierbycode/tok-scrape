import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const AddToWhitelistSchema = z.object({
	discordId: z.string(),
	discordUsername: z.string().optional(),
	reason: z.enum(["mod", "admin", "test_account", "bot"]),
	notes: z.string().optional(),
});

export const addToWhitelist = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/whitelist/add",
		tags: ["Administration"],
		summary: "Add Discord account to whitelist",
	})
	.input(AddToWhitelistSchema)
	.handler(async ({ input, context }) => {
		const { discordId, discordUsername, reason, notes } = input;

		const existing = await db.discordWhitelist.findUnique({
			where: { discordId },
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "This Discord account is already whitelisted",
			});
		}

		const entry = await db.discordWhitelist.create({
			data: {
				discordId,
				discordUsername,
				reason,
				notes,
				addedBy: context.user.id,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: discordId,
			summary: `Added Discord whitelist entry for ${discordUsername} (${discordId})`,
			metadata: {
				action: "whitelist_added",
				reason,
				notes,
			},
		});

		return { success: true, entry };
	});

export const removeFromWhitelist = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/whitelist/remove",
		tags: ["Administration"],
		summary: "Remove Discord account from whitelist",
	})
	.input(z.object({ discordId: z.string() }))
	.handler(async ({ input, context }) => {
		await db.discordWhitelist.update({
			where: { discordId: input.discordId },
			data: { active: false },
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.discordId,
			summary: `Removed Discord ID ${input.discordId} from whitelist`,
			metadata: { action: "whitelist_removed" },
		});

		return { success: true };
	});

export const getWhitelist = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/whitelist",
		tags: ["Administration"],
		summary: "Get Discord whitelist",
	})
	.handler(async () => {
		const whitelist = await db.discordWhitelist.findMany({
			where: { active: true },
			orderBy: { addedAt: "desc" },
		});

		return { whitelist };
	});

