import { db } from "@repo/database";
import { z } from "zod";
import { analyticsProcedure } from "../../../../orpc/procedures";

const AnalyticsInputSchema = z.object({
	timeRange: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
});

function daysBetween(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const getDiscordAnalytics = analyticsProcedure
	.route({
		method: "GET",
		path: "/admin/discord/analytics",
		tags: ["Administration"],
		summary: "Get Discord connection analytics",
	})
	.input(AnalyticsInputSchema)
	.handler(async ({ input }) => {
		const { timeRange } = input;

		const now = new Date();
		const dateThreshold = new Date(0);
		if (timeRange === "7d") {
			dateThreshold.setDate(now.getDate() - 7);
		}
		if (timeRange === "30d") {
			dateThreshold.setDate(now.getDate() - 30);
		}
		if (timeRange === "90d") {
			dateThreshold.setDate(now.getDate() - 90);
		}

		const totalConnections = await db.user.count({
			where: { discordConnected: true, deletedAt: null },
		});

		const newConnections = await db.user.count({
			where: {
				discordConnected: true,
				deletedAt: null,
				discordConnectedAt: { gte: dateThreshold },
			},
		});

		const disconnections = await db.discordAudit.count({
			where: {
				action: "disconnected",
				createdAt: { gte: dateThreshold },
			},
		});

		const gracePeriodChanges = await db.discordAudit.count({
			where: {
				action: "role_changed",
				reason: "payment_failed",
				createdAt: { gte: dateThreshold },
			},
		});

		const gracePeriodRecoveries = await db.discordAudit.count({
			where: {
				action: "role_changed",
				reason: "payment_succeeded",
				createdAt: { gte: dateThreshold },
			},
		});

		const spouseAccounts = await db.additionalDiscordAccount.count({
			where: { active: true },
		});

		const newSpouseAccounts = await db.additionalDiscordAccount.count({
			where: {
				active: true,
				addedAt: { gte: dateThreshold },
			},
		});

		const connectionTrend = await db.discordAudit.groupBy({
			by: ["createdAt"],
			where: {
				action: { in: ["connected", "disconnected"] },
				createdAt: {
					gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
				},
			},
			_count: { action: true },
		});

		const actionBreakdown = await db.discordAudit.groupBy({
			by: ["action"],
			where: { createdAt: { gte: dateThreshold } },
			_count: { action: true },
		});

		const thirtyDaysAgo = new Date(
			now.getTime() - 30 * 24 * 60 * 60 * 1000,
		);
		const recentConnects = await db.user.findMany({
			where: {
				deletedAt: null,
				discordConnected: true,
				discordConnectedAt: { gte: thirtyDaysAgo },
			},
			select: { discordConnectedAt: true },
		});

		const connectsByDayMap = new Map<string, number>();
		for (const u of recentConnects) {
			if (!u.discordConnectedAt) {
				continue;
			}
			const k = u.discordConnectedAt.toISOString().slice(0, 10);
			connectsByDayMap.set(k, (connectsByDayMap.get(k) ?? 0) + 1);
		}
		const connectsByDay = [...connectsByDayMap.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, count]) => ({ date, count }));

		const roleDistribution = await db.user.groupBy({
			by: ["discordRoleKey"],
			where: { deletedAt: null, discordConnected: true },
			_count: { id: true },
		});

		const connectedUsers = await db.user.findMany({
			where: {
				deletedAt: null,
				discordConnected: true,
				discordConnectedAt: { not: null },
			},
			select: {
				createdAt: true,
				discordConnectedAt: true,
			},
		});

		const bucketLabels = [
			"same day",
			"1 day",
			"2–7 days",
			"8–30 days",
			"31+ days",
		] as const;
		const buckets = [0, 0, 0, 0, 0];
		for (const u of connectedUsers) {
			if (!u.discordConnectedAt) {
				continue;
			}
			const d = daysBetween(u.createdAt, u.discordConnectedAt);
			if (d <= 0) {
				buckets[0]++;
			} else if (d === 1) {
				buckets[1]++;
			} else if (d <= 7) {
				buckets[2]++;
			} else if (d <= 30) {
				buckets[3]++;
			} else {
				buckets[4]++;
			}
		}
		const daysToConnectHistogram = bucketLabels.map((label, i) => ({
			label,
			count: buckets[i] ?? 0,
		}));

		return {
			timeRange,
			overview: {
				totalConnections,
				newConnections,
				disconnections,
				gracePeriodChanges,
				gracePeriodRecoveries,
				spouseAccounts,
				newSpouseAccounts,
			},
			trends: {
				connectionTrend: connectionTrend.map((t) => ({
					date: t.createdAt,
					count: t._count.action,
				})),
			},
			actions: actionBreakdown.map((a) => ({
				action: a.action,
				count: a._count.action,
			})),
			connectsByDay,
			roleDistribution: roleDistribution.map((r) => ({
				roleKey: r.discordRoleKey ?? "none",
				count: r._count.id,
			})),
			daysToConnectHistogram,
		};
	});
