import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import {
	buildDiscordMessageBody,
	createChannelMessage,
	deleteChannelMessage,
	editChannelMessage,
	getBotUserId,
	getChannelMessageRaw,
	getGuildId,
	listGuildChannels,
	messageToStudioPayload,
	parseDiscordMessageUrl,
} from "@repo/discord";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const embedFieldSchema = z.object({
	name: z.string().max(256),
	value: z.string().max(1024),
	inline: z.boolean().optional(),
});

const embedInputSchema = z
	.object({
		title: z.string().max(256).optional(),
		description: z.string().max(4096).optional(),
		url: z.string().max(2048).optional(),
		color: z.number().int().min(0).optional(),
		timestamp: z.string().max(50).optional(),
		footer: z
			.object({
				text: z.string().max(2048),
				iconUrl: z.string().max(2048).optional(),
			})
			.optional(),
		image: z.object({ url: z.string().max(2048) }).optional(),
		thumbnail: z.object({ url: z.string().max(2048) }).optional(),
		author: z
			.object({
				name: z.string().max(256),
				url: z.string().max(2048).optional(),
				iconUrl: z.string().max(2048).optional(),
			})
			.optional(),
		fields: z.array(embedFieldSchema).max(25).optional(),
	})
	.optional()
	.nullable();

const messageStudioPayloadSchema = z.object({
	content: z.string().max(2000),
	embed: embedInputSchema,
	linkButtons: z
		.array(
			z.object({
				label: z.string().min(1).max(80),
				url: z
					.string()
					.min(1)
					.max(512)
					.refine(
						(u) => /^https:\/\//i.test(u),
						"Link button URL must start with https://",
					),
			}),
		)
		.max(20),
	actionPreset: z.enum(["none", "billing_upgrade", "onboarding_complete"]),
	presetButtonLabel: z.string().max(80).optional(),
});

function requireDiscordConfig() {
	if (!process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) {
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "DISCORD_GUILD_ID or DISCORD_BOT_TOKEN is not configured",
		});
	}
}

function mapDiscordHttpError(status: number | undefined, discordBody?: string) {
	const snippet = discordBody?.slice(0, 500) ?? "";
	if (status === 403) {
		return new ORPCError("FORBIDDEN", {
			message: `Discord denied this action (403). Check bot permissions. ${snippet}`,
		});
	}
	if (status === 404) {
		return new ORPCError("NOT_FOUND", {
			message: `Discord resource not found (404). ${snippet}`,
		});
	}
	return new ORPCError("INTERNAL_SERVER_ERROR", {
		message: `Discord API error${status ? ` (${status})` : ""}: ${snippet || "unknown"}`,
	});
}

export const listMessageStudioChannels = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/message-studio/channels",
		tags: ["Administration"],
		summary: "List guild channels for Message Studio",
	})
	.handler(async ({ context }) => {
		requireDiscordConfig();
		const result = await listGuildChannels();
		if (!result.ok) {
			logger.error("listMessageStudioChannels failed", {
				error: result.error,
				adminId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: result.error,
			});
		}
		return { channels: result.channels };
	});

export const parseMessageStudioLink = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/parse-link",
		tags: ["Administration"],
		summary: "Parse a Discord message URL",
	})
	.input(z.object({ url: z.string().min(1) }))
	.handler(async ({ input }) => {
		requireDiscordConfig();
		let guildId: string;
		try {
			guildId = getGuildId();
		} catch {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "DISCORD_GUILD_ID is not set",
			});
		}
		const parsed = parseDiscordMessageUrl(input.url);
		if (!parsed) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Invalid message link. Expected discord.com/channels/GUILD/CHANNEL/MESSAGE",
			});
		}
		if (parsed.guildId !== guildId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "That message is not in the configured Discord server",
			});
		}
		return parsed;
	});

export const getMessageStudioDiscordMessage = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/get-message",
		tags: ["Administration"],
		summary: "Fetch a Discord message for editing",
	})
	.input(
		z.object({
			channelId: z.string().min(1),
			messageId: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		requireDiscordConfig();
		const bot = await getBotUserId();
		if (!bot.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: bot.error,
			});
		}
		const result = await getChannelMessageRaw(
			input.channelId,
			input.messageId,
		);
		if (!result.ok) {
			throw mapDiscordHttpError(result.status, result.discordBody);
		}
		const studioPayload = messageToStudioPayload(result.raw);
		const author = result.raw.author as { id?: string } | undefined;
		const authorMatchesBot = author?.id === bot.id;
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.messageId,
			summary: `Loaded Discord message ${input.messageId} for Message Studio`,
			metadata: {
				action: "message_studio_load",
				channelId: input.channelId,
			},
		});
		return {
			studioPayload,
			authorMatchesBot,
			botUserId: bot.id,
			authorId: author?.id ?? "",
		};
	});

export const postMessageStudioMessage = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/post",
		tags: ["Administration"],
		summary: "Post a new Discord message from Message Studio",
	})
	.input(
		z.object({
			channelId: z.string().min(1),
			payload: messageStudioPayloadSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		requireDiscordConfig();
		let body: Record<string, unknown>;
		try {
			body = buildDiscordMessageBody(input.payload);
		} catch (e) {
			throw new ORPCError("BAD_REQUEST", {
				message: e instanceof Error ? e.message : "Invalid payload",
			});
		}
		const result = await createChannelMessage(input.channelId, body);
		if (!result.ok) {
			throw mapDiscordHttpError(result.status, result.discordBody);
		}
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: result.message.id,
			summary: `Posted Discord message ${result.message.id} via Message Studio`,
			metadata: {
				action: "message_studio_post",
				channelId: input.channelId,
			},
		});
		return { messageId: result.message.id, channelId: input.channelId };
	});

export const patchMessageStudioMessage = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/patch",
		tags: ["Administration"],
		summary: "Edit an existing Discord message from Message Studio",
	})
	.input(
		z.object({
			channelId: z.string().min(1),
			messageId: z.string().min(1),
			payload: messageStudioPayloadSchema,
			confirmNonBotAuthor: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		requireDiscordConfig();
		const bot = await getBotUserId();
		if (!bot.ok) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: bot.error,
			});
		}
		const existing = await getChannelMessageRaw(
			input.channelId,
			input.messageId,
		);
		if (!existing.ok) {
			throw mapDiscordHttpError(existing.status, existing.discordBody);
		}
		const authorObj = existing.raw.author as { id?: string } | undefined;
		const authorId = authorObj?.id ?? "";
		if (authorId !== bot.id && !input.confirmNonBotAuthor) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"AUTHOR_NOT_BOT: This message was not sent by the bot. Confirm overwrite or use a bot-authored message.",
			});
		}
		let body: Record<string, unknown>;
		try {
			body = buildDiscordMessageBody(input.payload);
		} catch (e) {
			throw new ORPCError("BAD_REQUEST", {
				message: e instanceof Error ? e.message : "Invalid payload",
			});
		}
		const result = await editChannelMessage(
			input.channelId,
			input.messageId,
			body,
		);
		if (!result.ok) {
			throw mapDiscordHttpError(result.status, result.discordBody);
		}
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.messageId,
			summary: `Updated Discord message ${input.messageId} via Message Studio`,
			metadata: {
				action: "message_studio_patch",
				channelId: input.channelId,
			},
		});
		return { messageId: result.message.id, channelId: input.channelId };
	});

export const deleteMessageStudioDiscordMessage = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/delete-message",
		tags: ["Administration"],
		summary: "Delete a Discord message from Message Studio",
	})
	.input(
		z.object({
			channelId: z.string().min(1),
			messageId: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		requireDiscordConfig();
		const result = await deleteChannelMessage(
			input.channelId,
			input.messageId,
		);
		if (!result.ok) {
			throw mapDiscordHttpError(result.status, result.discordBody);
		}
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.messageId,
			summary: `Deleted Discord message ${input.messageId} via Message Studio`,
			metadata: {
				action: "message_studio_delete_discord",
				channelId: input.channelId,
			},
		});
		return { success: true as const };
	});

export const listMessageStudioTemplates = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/message-studio/templates",
		tags: ["Administration"],
		summary: "List saved Message Studio templates",
	})
	.handler(async () => {
		const rows = await db.discordMessageTemplate.findMany({
			orderBy: { updatedAt: "desc" },
			select: {
				id: true,
				name: true,
				channelId: true,
				messageId: true,
				updatedAt: true,
			},
		});
		return { templates: rows };
	});

export const getMessageStudioTemplate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/template/get",
		tags: ["Administration"],
		summary: "Get one Message Studio template",
	})
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ input }) => {
		const row = await db.discordMessageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!row) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found" });
		}
		const parsed = messageStudioPayloadSchema.safeParse(row.payload);
		const payload = parsed.success
			? parsed.data
			: messageStudioPayloadSchema.parse({
					content: "",
					embed: null,
					linkButtons: [],
					actionPreset: "none",
				});
		return {
			id: row.id,
			name: row.name,
			channelId: row.channelId,
			messageId: row.messageId,
			payload,
		};
	});

export const saveMessageStudioTemplate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/templates/save",
		tags: ["Administration"],
		summary: "Create or update a Message Studio template",
	})
	.input(
		z.object({
			id: z.string().optional(),
			name: z.string().min(1).max(200),
			channelId: z.string().min(1),
			messageId: z.string().nullable().optional(),
			payload: messageStudioPayloadSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		const data = {
			name: input.name,
			channelId: input.channelId,
			messageId: input.messageId ?? null,
			payload: input.payload as object,
			updatedByUserId: context.user.id,
		};
		if (input.id) {
			const row = await db.discordMessageTemplate.update({
				where: { id: input.id },
				data,
			});
			return { id: row.id };
		}
		const row = await db.discordMessageTemplate.create({ data });
		return { id: row.id };
	});

export const duplicateMessageStudioTemplate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/templates/duplicate",
		tags: ["Administration"],
		summary: "Duplicate a Message Studio template",
	})
	.input(
		z.object({
			id: z.string().min(1),
			name: z.string().min(1).max(200),
		}),
	)
	.handler(async ({ input, context }) => {
		const source = await db.discordMessageTemplate.findUnique({
			where: { id: input.id },
		});
		if (!source) {
			throw new ORPCError("NOT_FOUND", { message: "Template not found" });
		}
		const row = await db.discordMessageTemplate.create({
			data: {
				name: input.name,
				channelId: source.channelId,
				messageId: null,
				payload: source.payload as object,
				updatedByUserId: context.user.id,
			},
		});
		return { id: row.id };
	});

export const deleteMessageStudioTemplate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/message-studio/templates/delete",
		tags: ["Administration"],
		summary: "Delete a Message Studio template (DB only)",
	})
	.input(z.object({ id: z.string().min(1) }))
	.handler(async ({ input, context }) => {
		await db.discordMessageTemplate.delete({ where: { id: input.id } });
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "discord",
			targetId: input.id,
			summary: `Deleted Message Studio template ${input.id}`,
			metadata: { action: "message_studio_template_delete" },
		});
		return { success: true as const };
	});
