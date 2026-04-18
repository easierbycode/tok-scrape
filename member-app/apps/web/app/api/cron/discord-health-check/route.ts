import { db } from "@repo/database";
import { getDiscordBotUserAgent } from "@repo/discord";
import { logger } from "@repo/logs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DISCORD_API = "https://discord.com/api/v10";

async function fetchAllGuildMemberIds(
	guildId: string,
	botToken: string,
): Promise<Set<string>> {
	const ids = new Set<string>();
	let after: string | undefined;

	for (;;) {
		const qs = new URLSearchParams({ limit: "1000" });
		if (after) {
			qs.set("after", after);
		}
		const url = `${DISCORD_API}/guilds/${guildId}/members?${qs}`;

		const headers: HeadersInit = {
			Authorization: `Bot ${botToken}`,
			"User-Agent": getDiscordBotUserAgent(),
		};

		let response = await fetch(url, { method: "GET", headers });

		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			const seconds = Number.parseFloat(retryAfter ?? "1") || 1;
			const ms = Math.min(seconds * 1000, 10_000);
			await new Promise((r) => setTimeout(r, ms));
			response = await fetch(url, { method: "GET", headers });
		}

		if (!response.ok) {
			const body = await response.text();
			throw new Error(
				`Discord list members failed (${response.status}): ${body}`,
			);
		}

		const members = (await response.json()) as { user?: { id: string } }[];

		if (members.length === 0) {
			break;
		}

		for (const m of members) {
			if (m.user?.id) {
				ids.add(m.user.id);
			}
		}

		if (members.length < 1000) {
			break;
		}

		const lastUserId = members[members.length - 1]?.user?.id;
		if (!lastUserId) {
			break;
		}
		after = lastUserId;
	}

	return ids;
}

export async function GET(request: Request) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		return NextResponse.json(
			{ error: "CRON_SECRET not configured" },
			{ status: 500 },
		);
	}

	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const guildId = process.env.DISCORD_GUILD_ID;
	const botToken = process.env.DISCORD_BOT_TOKEN;

	if (!guildId || !botToken) {
		logger.error("Discord health check: DISCORD_GUILD_ID or token not set");
		return NextResponse.json(
			{ error: "Discord not configured" },
			{ status: 500 },
		);
	}

	try {
		const memberIds = await fetchAllGuildMemberIds(guildId, botToken);

		const whitelist = await db.discordWhitelist.findMany({
			where: { active: true },
		});
		const whitelistIds = new Set(whitelist.map((w) => w.discordId));

		const criticalIssues: {
			type: string;
			email: string | null;
			discordId: string;
		}[] = [];

		const connectedUsers = await db.user.findMany({
			where: {
				discordConnected: true,
				discordId: { not: null },
			},
			select: {
				id: true,
				email: true,
				discordId: true,
				discordUsername: true,
				purchases: {
					where: {
						status: { in: ["active", "grace_period"] },
					},
					take: 1,
					select: { id: true },
				},
			},
		});

		let reconciled = 0;

		for (const user of connectedUsers) {
			const discordId = user.discordId;
			if (!discordId) {
				continue;
			}
			if (whitelistIds.has(discordId)) {
				continue;
			}
			if (memberIds.has(discordId)) {
				continue;
			}

			await db.$transaction(async (tx) => {
				await tx.user.update({
					where: { id: user.id },
					data: {
						discordConnected: false,
						discordConnectedAt: null,
					},
				});

				await tx.account.deleteMany({
					where: {
						userId: user.id,
						providerId: "discord",
					},
				});

				await tx.discordAudit.create({
					data: {
						userId: user.id,
						discordId,
						discordUsername: user.discordUsername,
						action: "disconnected",
						reason: "reconcile_not_in_guild",
					},
				});
			});

			reconciled += 1;

			if (user.purchases.length > 0) {
				criticalIssues.push({
					type: "active_user_not_in_discord",
					email: user.email,
					discordId,
				});
			}
		}

		if (criticalIssues.length > 0) {
			const { notifyAllAdmins } = await import("@repo/database");

			await notifyAllAdmins({
				type: "discord_sync_issue",
				title: "Discord Health Check Alert",
				message: `${criticalIssues.length} users with active subscriptions are not in Discord server.

View details: /admin/discord/sync-check`,
			});
		}

		// Second pass: clean up orphaned Discord OAuth account rows for users
		// whose discordConnected flag is already false. These are left behind when
		// the webhook flow sets the flag but fails to delete the account row.
		const orphanedAccounts = await db.account.findMany({
			where: {
				providerId: "discord",
				user: {
					discordConnected: false,
				},
			},
			select: {
				id: true,
				accountId: true,
				userId: true,
				user: {
					select: {
						discordId: true,
						discordUsername: true,
					},
				},
			},
		});

		let orphansReconciled = 0;

		for (const account of orphanedAccounts) {
			await db.$transaction(async (tx) => {
				await tx.account.delete({ where: { id: account.id } });

				await tx.discordAudit.create({
					data: {
						userId: account.userId,
						discordId: account.accountId,
						discordUsername: account.user.discordUsername,
						action: "disconnected",
						reason: "reconcile_orphaned_account",
					},
				});
			});

			orphansReconciled += 1;
		}

		if (orphansReconciled > 0) {
			logger.info("Discord health check: orphaned accounts cleaned up", {
				orphansReconciled,
			});
		}

		logger.info("Discord health check cron completed", {
			totalMembers: memberIds.size,
			criticalIssues: criticalIssues.length,
			reconciled,
			orphansReconciled,
		});

		return NextResponse.json({
			success: true,
			issues: criticalIssues.length,
			reconciled,
			orphansReconciled,
			memberCount: memberIds.size,
		});
	} catch (error) {
		logger.error("Discord health check cron failed", { error });
		return NextResponse.json(
			{ error: "Failed to run health check" },
			{ status: 500 },
		);
	}
}
