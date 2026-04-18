/**
 * Discord channel message REST API (create, get, edit, delete, list channels).
 * Serverless-safe; uses bot token like manage-roles.ts.
 */

import { logger } from "@repo/logs";
import { getDiscordBotUserAgent, getGuildId } from "./helpers";

const DISCORD_API = "https://discord.com/api/v10";

/** Guild text-like channels suitable for posting (text, announcement, forum). */
const POSTABLE_CHANNEL_TYPES = new Set([0, 5, 15]);

export interface DiscordChannelSummary {
	id: string;
	name: string;
	type: number;
	parentId: string | null;
}

export interface DiscordMessageAuthor {
	id: string;
	username: string;
	bot?: boolean;
}

export interface DiscordMessageResult {
	id: string;
	channelId: string;
	content: string | null;
	embeds: unknown[];
	components: unknown[];
	author: DiscordMessageAuthor;
}

function getBotToken(): string | null {
	return process.env.DISCORD_BOT_TOKEN ?? null;
}

function botHeaders(): HeadersInit {
	const botToken = getBotToken();
	if (!botToken) {
		throw new Error("DISCORD_BOT_TOKEN is not set");
	}
	return {
		Authorization: `Bot ${botToken}`,
		"User-Agent": getDiscordBotUserAgent(),
		"Content-Type": "application/json",
	};
}

export async function listGuildChannels(): Promise<
	| { ok: true; channels: DiscordChannelSummary[] }
	| { ok: false; error: string; status?: number }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}
	let guildId: string;
	try {
		guildId = getGuildId();
	} catch {
		return { ok: false, error: "DISCORD_GUILD_ID is not set" };
	}

	const url = `${DISCORD_API}/guilds/${guildId}/channels`;
	const response = await fetch(url, {
		method: "GET",
		headers: botHeaders(),
	});

	if (!response.ok) {
		const body = await response.text();
		logger.error("Discord list channels failed", {
			status: response.status,
			body,
		});
		return {
			ok: false,
			error: `Discord API error (${response.status}): ${body}`,
			status: response.status,
		};
	}

	const raw = (await response.json()) as Array<{
		id: string;
		name: string;
		type: number;
		parent_id?: string | null;
	}>;

	const channels: DiscordChannelSummary[] = raw
		.filter((c) => POSTABLE_CHANNEL_TYPES.has(c.type))
		.map((c) => ({
			id: c.id,
			name: c.name,
			type: c.type,
			parentId: c.parent_id ?? null,
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	return { ok: true, channels };
}

export async function getBotUserId(): Promise<
	{ ok: true; id: string } | { ok: false; error: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const response = await fetch(`${DISCORD_API}/users/@me`, {
		method: "GET",
		headers: botHeaders(),
	});

	if (!response.ok) {
		const body = await response.text();
		return {
			ok: false,
			error: `Discord API error (${response.status}): ${body}`,
		};
	}

	const data = (await response.json()) as { id?: string };
	if (!data.id) {
		return { ok: false, error: "Invalid response from Discord @me" };
	}
	return { ok: true, id: data.id };
}

export async function createChannelMessage(
	channelId: string,
	body: Record<string, unknown>,
): Promise<
	| { ok: true; message: DiscordMessageResult }
	| { ok: false; error: string; status?: number; discordBody?: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const url = `${DISCORD_API}/channels/${channelId}/messages`;
	const response = await fetch(url, {
		method: "POST",
		headers: botHeaders(),
		body: JSON.stringify(body),
	});

	const responseText = await response.text();
	if (!response.ok) {
		logger.error("Discord create message failed", {
			channelId,
			status: response.status,
			body: responseText,
		});
		return {
			ok: false,
			error: `Discord API error (${response.status})`,
			status: response.status,
			discordBody: responseText,
		};
	}

	const data = JSON.parse(responseText) as Record<string, unknown>;
	return { ok: true, message: normalizeMessage(data, channelId) };
}

export async function getChannelMessage(
	channelId: string,
	messageId: string,
): Promise<
	| { ok: true; message: DiscordMessageResult }
	| { ok: false; error: string; status?: number; discordBody?: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}`;
	const response = await fetch(url, {
		method: "GET",
		headers: botHeaders(),
	});

	const responseText = await response.text();
	if (!response.ok) {
		return {
			ok: false,
			error: `Discord API error (${response.status})`,
			status: response.status,
			discordBody: responseText,
		};
	}

	const data = JSON.parse(responseText) as Record<string, unknown>;
	return { ok: true, message: normalizeMessage(data, channelId) };
}

export async function getChannelMessageRaw(
	channelId: string,
	messageId: string,
): Promise<
	| { ok: true; raw: Record<string, unknown> }
	| { ok: false; error: string; status?: number; discordBody?: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}`;
	const response = await fetch(url, {
		method: "GET",
		headers: botHeaders(),
	});

	const responseText = await response.text();
	if (!response.ok) {
		return {
			ok: false,
			error: `Discord API error (${response.status})`,
			status: response.status,
			discordBody: responseText,
		};
	}

	const raw = JSON.parse(responseText) as Record<string, unknown>;
	return { ok: true, raw };
}

export async function editChannelMessage(
	channelId: string,
	messageId: string,
	body: Record<string, unknown>,
): Promise<
	| { ok: true; message: DiscordMessageResult }
	| { ok: false; error: string; status?: number; discordBody?: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}`;
	const response = await fetch(url, {
		method: "PATCH",
		headers: botHeaders(),
		body: JSON.stringify(body),
	});

	const responseText = await response.text();
	if (!response.ok) {
		return {
			ok: false,
			error: `Discord API error (${response.status})`,
			status: response.status,
			discordBody: responseText,
		};
	}

	const data = JSON.parse(responseText) as Record<string, unknown>;
	return { ok: true, message: normalizeMessage(data, channelId) };
}

export async function deleteChannelMessage(
	channelId: string,
	messageId: string,
): Promise<
	{ ok: true } | { ok: false; error: string; status?: number; discordBody?: string }
> {
	const token = getBotToken();
	if (!token) {
		return { ok: false, error: "DISCORD_BOT_TOKEN is not set" };
	}

	const url = `${DISCORD_API}/channels/${channelId}/messages/${messageId}`;
	const response = await fetch(url, {
		method: "DELETE",
		headers: botHeaders(),
	});

	if (response.status === 204) {
		return { ok: true };
	}

	const responseText = await response.text();
	return {
		ok: false,
		error: `Discord API error (${response.status})`,
		status: response.status,
		discordBody: responseText,
	};
}

function normalizeMessage(
	data: Record<string, unknown>,
	fallbackChannelId: string,
): DiscordMessageResult {
	const author = data.author as DiscordMessageAuthor | undefined;
	const channelId =
		(typeof data.channel_id === "string" && data.channel_id) ||
		fallbackChannelId;
	return {
		id: String(data.id ?? ""),
		channelId,
		content: typeof data.content === "string" ? data.content : null,
		embeds: Array.isArray(data.embeds) ? data.embeds : [],
		components: Array.isArray(data.components) ? data.components : [],
		author: author ?? { id: "", username: "" },
	};
}
