/**
 * Helper functions for Discord operations
 */

import { DISCORD_CONFIG } from "@repo/config/constants";
import { logger } from "@repo/logs";

/**
 * Get Discord guild ID from config
 */
export function getGuildId(): string {
	const guildId = DISCORD_CONFIG.guildId;
	if (!guildId) {
		throw new Error("DISCORD_GUILD_ID environment variable is not set");
	}
	return guildId;
}

/**
 * User-Agent for Discord HTTP API (required format per Discord; missing/invalid UA may be blocked).
 * @see https://discord.com/developers/docs/reference#user-agent
 */
export function getDiscordBotUserAgent(): string {
	const custom = process.env.DISCORD_HTTP_USER_AGENT?.trim();
	if (custom) {
		return custom;
	}
	return "DiscordBot (https://lifepreneur.com, 1)";
}

/**
 * Get Active Member role ID from config
 */
export function getActiveRoleId(): string {
	const roleId = DISCORD_CONFIG.activeRoleId;
	if (!roleId) {
		throw new Error(
			"DISCORD_ACTIVE_ROLE_ID environment variable is not set",
		);
	}
	return roleId;
}

/**
 * Get Grace Period role ID from config
 */
export function getGracePeriodRoleId(): string {
	const roleId = DISCORD_CONFIG.gracePeriodRoleId;
	if (!roleId) {
		throw new Error(
			"DISCORD_GRACE_PERIOD_ROLE_ID environment variable is not set",
		);
	}
	return roleId;
}

/**
 * Resolve a Discord role ID from an environment variable key (e.g. DISCORD_STARTER_ROLE_ID).
 */
export function resolvePlanRoleId(envKey: string): string | null {
	return process.env[envKey]?.trim() || null;
}

/**
 * Log Discord operation result
 */
export function logDiscordOperation(
	operation: string,
	success: boolean,
	details?: Record<string, unknown>,
): void {
	if (success) {
		logger.info(`Discord ${operation} succeeded`, details);
	} else {
		logger.error(`Discord ${operation} failed`, details);
	}
}
