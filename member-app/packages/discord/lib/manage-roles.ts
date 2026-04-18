/**
 * Discord role management functions
 *
 * Uses Discord REST API (serverless-safe on Vercel). No Gateway client required.
 */

import { logger } from "@repo/logs";
import {
	getActiveRoleId,
	getDiscordBotUserAgent,
	getGracePeriodRoleId,
	getGuildId,
	logDiscordOperation,
} from "./helpers";
import type { DiscordResult } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

function getBotTokenOrError(): DiscordResult | null {
	const botToken = process.env.DISCORD_BOT_TOKEN;
	if (!botToken) {
		return {
			success: false,
			error: "DISCORD_BOT_TOKEN environment variable is not set",
		};
	}
	return null;
}

function botHeaders(auditReason: string): HeadersInit {
	const botToken = process.env.DISCORD_BOT_TOKEN;
	return {
		Authorization: `Bot ${botToken}`,
		"User-Agent": getDiscordBotUserAgent(),
		"X-Audit-Log-Reason": encodeURIComponent(auditReason),
	};
}

async function restGetGuildMemberRoles(
	guildId: string,
	discordUserId: string,
): Promise<
	{ ok: true; roles: string[] } | { ok: false; status: number; body: string }
> {
	const tokenErr = getBotTokenOrError();
	if (tokenErr) {
		return {
			ok: false,
			status: 500,
			body: tokenErr.error ?? "No bot token",
		};
	}

	const url = `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`;
	const response = await fetch(url, {
		method: "GET",
		headers: botHeaders("Lifepreneur: read member roles"),
	});

	if (response.status === 404) {
		return { ok: false, status: 404, body: "Member not in guild" };
	}

	if (!response.ok) {
		const body = await response.text();
		return { ok: false, status: response.status, body };
	}

	const data = (await response.json()) as { roles?: string[] };
	return { ok: true, roles: data.roles ?? [] };
}

async function restAddMemberRole(
	guildId: string,
	discordUserId: string,
	roleId: string,
	auditReason: string,
): Promise<DiscordResult> {
	const tokenErr = getBotTokenOrError();
	if (tokenErr) {
		return tokenErr;
	}

	const url = `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
	const response = await fetch(url, {
		method: "PUT",
		headers: botHeaders(auditReason),
	});

	if (response.status === 204 || response.status === 200) {
		return { success: true };
	}

	const errorBody = await response.text();
	logger.error("Discord REST add role failed", {
		discordUserId,
		roleId,
		status: response.status,
		body: errorBody,
	});

	return {
		success: false,
		error: `Discord API error (${response.status}): ${errorBody}`,
	};
}

async function restRemoveMemberRole(
	guildId: string,
	discordUserId: string,
	roleId: string,
	auditReason: string,
): Promise<DiscordResult> {
	const tokenErr = getBotTokenOrError();
	if (tokenErr) {
		return tokenErr;
	}

	const url = `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
	const response = await fetch(url, {
		method: "DELETE",
		headers: botHeaders(auditReason),
	});

	if (response.status === 204 || response.status === 200) {
		return { success: true };
	}

	// Idempotent: role already absent
	if (response.status === 404) {
		return { success: true };
	}

	const errorBody = await response.text();
	logger.error("Discord REST remove role failed", {
		discordUserId,
		roleId,
		status: response.status,
		body: errorBody,
	});

	return {
		success: false,
		error: `Discord API error (${response.status}): ${errorBody}`,
	};
}

/**
 * Remove a role from a guild member (REST). Public for HTTP interactions / admin flows.
 */
export async function removeGuildMemberRole(
	discordUserId: string,
	roleId: string,
	auditReason: string,
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();
		return await restRemoveMemberRole(
			guildId,
			discordUserId,
			roleId,
			auditReason,
		);
	} catch (error) {
		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown error removing role",
		};
	}
}

/**
 * Grant Active Member role to user
 */
export async function grantActiveRole(
	discordUserId: string,
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();
		const roleId = getActiveRoleId();
		const graceRoleId = getGracePeriodRoleId();

		const member = await restGetGuildMemberRoles(guildId, discordUserId);
		if (!member.ok) {
			if (member.status === 404) {
				return {
					success: false,
					error: "User is not a member of the Discord server",
				};
			}
			return {
				success: false,
				error: `Discord API error (${member.status}): ${member.body}`,
			};
		}

		// Remove grace period role if present — user is recovering to active
		if (member.roles.includes(graceRoleId)) {
			const removeGrace = await restRemoveMemberRole(
				guildId,
				discordUserId,
				graceRoleId,
				"Lifepreneur: remove grace period role on active restore",
			);
			if (!removeGrace.success) {
				return removeGrace;
			}
		}

		if (member.roles.includes(roleId)) {
			logDiscordOperation("grantActiveRole", true, {
				discordUserId,
				note: "User already has Active Member role",
				via: "rest",
			});
			return { success: true };
		}

		const add = await restAddMemberRole(
			guildId,
			discordUserId,
			roleId,
			"Lifepreneur: grant active member role",
		);
		if (!add.success) {
			return add;
		}

		logDiscordOperation("grantActiveRole", true, {
			discordUserId,
			roleId,
			via: "rest",
		});

		return { success: true };
	} catch (error) {
		logger.error("Error granting Active Member role", {
			discordUserId,
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

/**
 * Change user role from Active Member to Grace Period
 */
export async function changeToGracePeriodRole(
	discordUserId: string,
	additionalRoleIdToRemove?: string,
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();
		const activeRoleId = getActiveRoleId();
		const graceRoleId = getGracePeriodRoleId();

		const member = await restGetGuildMemberRoles(guildId, discordUserId);
		if (!member.ok) {
			if (member.status === 404) {
				return {
					success: false,
					error: "User is not a member of the Discord server",
				};
			}
			return {
				success: false,
				error: `Discord API error (${member.status}): ${member.body}`,
			};
		}

		const { roles } = member;

		if (roles.includes(activeRoleId)) {
			const removeActive = await restRemoveMemberRole(
				guildId,
				discordUserId,
				activeRoleId,
				"Lifepreneur: remove active role for grace period",
			);
			if (!removeActive.success) {
				return removeActive;
			}
		}

		if (
			additionalRoleIdToRemove &&
			roles.includes(additionalRoleIdToRemove)
		) {
			const removeExtra = await restRemoveMemberRole(
				guildId,
				discordUserId,
				additionalRoleIdToRemove,
				"Lifepreneur: remove plan role for grace period",
			);
			if (!removeExtra.success) {
				return removeExtra;
			}
		}

		const afterRemovals = await restGetGuildMemberRoles(
			guildId,
			discordUserId,
		);
		if (!afterRemovals.ok) {
			if (afterRemovals.status === 404) {
				return {
					success: false,
					error: "User is not a member of the Discord server",
				};
			}
			return {
				success: false,
				error: `Discord API error (${afterRemovals.status}): ${afterRemovals.body}`,
			};
		}

		if (!afterRemovals.roles.includes(graceRoleId)) {
			const addGrace = await restAddMemberRole(
				guildId,
				discordUserId,
				graceRoleId,
				"Lifepreneur: grant grace period role",
			);
			if (!addGrace.success) {
				return addGrace;
			}
		}

		logDiscordOperation("changeToGracePeriodRole", true, {
			discordUserId,
			activeRoleId,
			graceRoleId,
			additionalRoleIdToRemove,
			via: "rest",
		});

		return { success: true };
	} catch (error) {
		logger.error("Error changing to Grace Period role", {
			discordUserId,
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

/**
 * Remove known plan roles and assign the current plan role in one guild/member fetch.
 */
export async function swapPlanRole(
	discordUserId: string,
	oldRoleIds: string[],
	newRoleId: string,
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();

		const member = await restGetGuildMemberRoles(guildId, discordUserId);
		if (!member.ok) {
			if (member.status === 404) {
				return {
					success: false,
					error: "User is not a member of the Discord server",
				};
			}
			return {
				success: false,
				error: `Discord API error (${member.status}): ${member.body}`,
			};
		}

		const { roles } = member;
		const uniqueOldIds = [...new Set(oldRoleIds.filter(Boolean))];

		for (const oldId of uniqueOldIds) {
			if (oldId === newRoleId) {
				continue;
			}
			if (!roles.includes(oldId)) {
				continue;
			}
			const removed = await restRemoveMemberRole(
				guildId,
				discordUserId,
				oldId,
				"Lifepreneur: swap plan role remove old",
			);
			if (!removed.success) {
				return removed;
			}
		}

		const afterSwap = await restGetGuildMemberRoles(guildId, discordUserId);
		if (!afterSwap.ok) {
			if (afterSwap.status === 404) {
				return {
					success: false,
					error: "User is not a member of the Discord server",
				};
			}
			return {
				success: false,
				error: `Discord API error (${afterSwap.status}): ${afterSwap.body}`,
			};
		}

		if (!afterSwap.roles.includes(newRoleId)) {
			const added = await restAddMemberRole(
				guildId,
				discordUserId,
				newRoleId,
				"Lifepreneur: swap plan role add new",
			);
			if (!added.success) {
				return added;
			}
		}

		logDiscordOperation("swapPlanRole", true, {
			discordUserId,
			newRoleId,
			removedRoleIds: uniqueOldIds,
			via: "rest",
		});

		return { success: true };
	} catch (error) {
		logger.error("Error swapping plan role", {
			discordUserId,
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

/**
 * Remove user from Discord server (kick / remove member).
 *
 * Uses the Discord REST API so this works on Vercel serverless (no gateway).
 */
export async function removeUserFromServer(
	discordUserId: string,
	auditReason = "Lifepreneur: removed by admin or billing flow",
): Promise<DiscordResult> {
	try {
		const guildId = getGuildId();
		const botToken = process.env.DISCORD_BOT_TOKEN;
		if (!botToken) {
			return {
				success: false,
				error: "DISCORD_BOT_TOKEN environment variable is not set",
			};
		}

		const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
		const response = await fetch(url, {
			method: "DELETE",
			headers: {
				Authorization: `Bot ${botToken}`,
				"User-Agent": getDiscordBotUserAgent(),
				"X-Audit-Log-Reason": encodeURIComponent(auditReason),
			},
		});

		if (response.status === 204 || response.status === 200) {
			logDiscordOperation("removeUserFromServer", true, {
				discordUserId,
				guildId,
				via: "rest",
			});
			return { success: true };
		}

		// Not in guild — treat as success so unlink / churn flows stay idempotent
		if (response.status === 404) {
			logger.info("Discord remove member: user not in guild (noop)", {
				discordUserId,
				guildId,
			});
			logDiscordOperation("removeUserFromServer", true, {
				discordUserId,
				guildId,
				via: "rest",
				note: "member_not_in_guild",
			});
			return { success: true };
		}

		const errorBody = await response.text();
		logger.error("Discord REST remove member failed", {
			discordUserId,
			status: response.status,
			body: errorBody,
		});

		return {
			success: false,
			error: `Discord API error (${response.status}): ${errorBody}`,
		};
	} catch (error) {
		logger.error("Error removing user from Discord server", {
			discordUserId,
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
