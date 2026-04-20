import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { adminProcedure } from "../../../../orpc/procedures";

async function fetchAllGuildMembers(
	guildId: string,
	botToken: string,
): Promise<Map<string, { username: string; bot: boolean }>> {
	const members = new Map<string, { username: string; bot: boolean }>();
	let after = "0";
	const limit = 1000;

	while (true) {
		const res = await fetch(
			`https://discord.com/api/v10/guilds/${guildId}/members?limit=${limit}&after=${after}`,
			{
				headers: {
					Authorization: `Bot ${botToken}`,
				},
			},
		);

		if (!res.ok) {
			const body = await res.text();
			throw new Error(
				`Discord API error fetching members: ${res.status} ${body}`,
			);
		}

		const batch: Array<{
			user: { id: string; username: string; bot?: boolean };
		}> = await res.json();

		for (const m of batch) {
			members.set(m.user.id, {
				username: m.user.username,
				bot: m.user.bot ?? false,
			});
		}

		if (batch.length < limit) break;
		after = batch[batch.length - 1].user.id;
	}

	return members;
}

export const runSyncHealthCheck = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/sync-health-check",
		tags: ["Administration"],
		summary: "Check for Discord/database sync discrepancies",
	})
	.handler(async () => {
		const guildId = process.env.DISCORD_GUILD_ID;
		const botToken = process.env.DISCORD_BOT_TOKEN;

		if (!guildId || !botToken) {
			return {
				success: false,
				error: "DISCORD_GUILD_ID or DISCORD_BOT_TOKEN is not configured",
			};
		}

		try {
			const members = await fetchAllGuildMembers(guildId, botToken);

			// Get whitelist
			const whitelist = await db.discordWhitelist.findMany({
				where: { active: true },
			});
			const whitelistIds = new Set(whitelist.map((w) => w.discordId));

			// Get users with Discord connected
			const usersWithDiscord = await db.user.findMany({
				where: { discordConnected: true },
				select: {
					id: true,
					discordId: true,
					discordUsername: true,
					email: true,
					purchases: {
						where: { status: { in: ["active", "grace_period"] } },
					},
				},
			});

			// Get additional Discord accounts
			const additionalAccounts = await db.additionalDiscordAccount.findMany({
				where: { active: true },
				select: { discordId: true },
			});
			const additionalIds = new Set(additionalAccounts.map((a) => a.discordId));

		const issues = [];
		let botsExcluded = 0;

		// Check 1: Users in Discord but not in database (excluding whitelist)
		for (const [discordId, member] of members) {
			if (member.bot) {
				botsExcluded++;
				continue;
			}
			if (whitelistIds.has(discordId)) continue; // Skip whitelisted

				const inDatabase = usersWithDiscord.some((u) => u.discordId === discordId);
				const isAdditional = additionalIds.has(discordId);

				if (!inDatabase && !isAdditional) {
					issues.push({
						type: "in_discord_not_database",
						discordId,
						username: member.username,
						severity: "high",
						message: `User ${member.username} (${discordId}) is in Discord but has no database record`,
					});
				}
			}

			// Check 2: Users in database but not in Discord (with active subscription)
			for (const user of usersWithDiscord) {
				if (!user.discordId) continue;
				if (whitelistIds.has(user.discordId)) continue;

				const inDiscord = members.has(user.discordId);
				const hasActiveAccess = user.purchases.length > 0;

				if (!inDiscord && hasActiveAccess) {
					issues.push({
						type: "in_database_not_discord",
						userId: user.id,
						discordId: user.discordId,
						username: user.discordUsername,
						email: user.email,
						severity: "medium",
						message: `User ${user.email} (${user.discordId}) has active subscription but is not in Discord`,
					});
				}
			}

			// Check 3: Users with discordConnected=true but no discordId
			const orphanedConnections = await db.user.count({
				where: {
					discordConnected: true,
					discordId: null,
				},
			});

			if (orphanedConnections > 0) {
				issues.push({
					type: "data_integrity",
					severity: "low",
					message: `${orphanedConnections} users have discordConnected=true but no discordId`,
				});
			}

			// Send admin notification if issues found
			if (issues.length > 0) {
				const { notifyAllAdmins } = await import("@repo/database");

				const highSeverity = issues.filter((i) => i.severity === "high").length;
				const mediumSeverity = issues.filter((i) => i.severity === "medium").length;

				await notifyAllAdmins({
					type: "discord_sync_issue",
					title: "Discord Sync Issues Detected",
					message: `Health check found ${issues.length} issues:
- ${highSeverity} high severity
- ${mediumSeverity} medium severity

View details: /admin/discord/sync-check`,
				});
			}

			logger.info("Discord sync health check completed", {
				totalIssues: issues.length,
				serverMembers: members.size,
				databaseUsers: usersWithDiscord.length,
				whitelisted: whitelist.length,
			});

		const humanMembers = members.size - botsExcluded;

		return {
			success: true,
			summary: {
				totalMembers: members.size,
				botsExcluded,
				humanMembers,
				totalDatabaseUsers: usersWithDiscord.length,
				totalWhitelisted: whitelist.length,
				totalIssues: issues.length,
			},
				issues,
				whitelist: whitelist.map((w) => ({
					discordId: w.discordId,
					username: w.discordUsername,
					reason: w.reason,
					notes: w.notes,
				})),
			};
		} catch (error) {
			logger.error("Discord sync health check failed", { error });
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	});

