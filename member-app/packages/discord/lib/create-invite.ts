/**
 * Create temporary Discord invite links (REST API — serverless-safe)
 */

import { logger } from "@repo/logs";
import { getDiscordBotUserAgent } from "./helpers";
import type { DiscordResult } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

interface InviteResult extends DiscordResult {
	inviteUrl?: string;
	inviteCode?: string;
}

interface DiscordInviteResponse {
	code: string;
}

/**
 * Create a temporary Discord invite link
 * @param maxAge - Time in seconds until invite expires (default: 7 days)
 * @param maxUses - Maximum number of uses (default: 1)
 */
export async function createTemporaryInvite(
	maxAge = 604800, // 7 days in seconds
	maxUses = 1,
): Promise<InviteResult> {
	try {
		const welcomeChannelId = process.env.DISCORD_WELCOME_CHANNEL_ID?.trim();
		if (!welcomeChannelId) {
			return {
				success: false,
				error: "DISCORD_WELCOME_CHANNEL_ID is not set (required for REST invite creation)",
			};
		}

		const botToken = process.env.DISCORD_BOT_TOKEN;
		if (!botToken) {
			return {
				success: false,
				error: "DISCORD_BOT_TOKEN environment variable is not set",
			};
		}

		const url = `${DISCORD_API}/channels/${welcomeChannelId}/invites`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bot ${botToken}`,
				"Content-Type": "application/json",
				"User-Agent": getDiscordBotUserAgent(),
				"X-Audit-Log-Reason": encodeURIComponent(
					"Spouse/family account invitation from admin",
				),
			},
			body: JSON.stringify({
				max_age: maxAge,
				max_uses: maxUses,
				unique: true,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			logger.error("Discord REST create invite failed", {
				channelId: welcomeChannelId,
				status: response.status,
				body,
			});
			return {
				success: false,
				error: `Discord API error (${response.status}): ${body}`,
			};
		}

		const invite = (await response.json()) as DiscordInviteResponse;
		if (!invite.code) {
			return {
				success: false,
				error: "Discord invite response missing code",
			};
		}

		const inviteUrl = `https://discord.gg/${invite.code}`;

		logger.info("Created temporary Discord invite (REST)", {
			inviteCode: invite.code,
			url: inviteUrl,
			maxUses,
			channelId: welcomeChannelId,
		});

		return {
			success: true,
			inviteUrl,
			inviteCode: invite.code,
		};
	} catch (error) {
		logger.error("Error creating Discord invite", {
			error: error instanceof Error ? error.message : String(error),
		});

		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to create Discord invite",
		};
	}
}
