/**
 * Add user to Discord server via OAuth access token
 *
 * Note: Discord bots cannot directly add users via API.
 * This function uses the OAuth access token from Better-Auth
 * to add the user to the server via Discord's OAuth2 API.
 */

import { logger } from "@repo/logs";
import {
	getDiscordBotUserAgent,
	getGuildId,
	logDiscordOperation,
} from "./helpers";
import type { DiscordResult, DiscordUserData } from "./types";

/**
 * Add user to Discord server using OAuth access token
 *
 * This requires the user to have completed Discord OAuth
 * with the 'guilds.join' scope (already configured in Better-Auth).
 *
 * The access token is stored in the Account table by Better-Auth.
 */
export async function addUserToServer(
	userId: string,
	accessToken: string,
	userData: DiscordUserData,
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();

		// Use Discord REST API to add member to guild
		// This requires the OAuth access token with 'guilds.join' scope
		// The bot token is used for authorization, but the user's OAuth token is passed in the body
		const response = await fetch(
			`https://discord.com/api/v10/guilds/${guildId}/members/${userData.discordId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
					"Content-Type": "application/json",
					"User-Agent": getDiscordBotUserAgent(),
				},
				body: JSON.stringify({
					access_token: accessToken, // User's OAuth access token from Better-Auth
				}),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			logger.error("Failed to add user to Discord server", {
				userId,
				discordId: userData.discordId,
				status: response.status,
				error: errorText,
			});

			// Handle specific error cases
			if (response.status === 403) {
				return {
					success: false,
					error: "Bot lacks permission to add members",
				};
			}
			if (response.status === 404) {
				return {
					success: false,
					error: "Guild or user not found",
				};
			}

			return {
				success: false,
				error: `Discord API error: ${response.status}`,
			};
		}

		logDiscordOperation("addUserToServer", true, {
			userId,
			discordId: userData.discordId,
			guildId,
		});

		return { success: true };
	} catch (error) {
		logger.error("Error adding user to Discord server", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});

		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown error occurred",
		};
	}
}
