/**
 * Type definitions for Discord bot operations
 */

export interface DiscordResult {
	success: boolean;
	error?: string;
}

export interface DiscordUserData {
	discordId: string;
	username: string;
	accessToken: string;
}
