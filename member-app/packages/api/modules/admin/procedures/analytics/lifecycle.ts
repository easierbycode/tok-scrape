import { db } from "@repo/database";
import { z } from "zod";
import { analyticsProcedure } from "../../../../orpc/procedures";

const SUBSCRIBER_STATUSES = ["active", "trialing", "grace_period"] as const;

function monthKey(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

function median(sorted: number[]): number | null {
	if (sorted.length === 0) {
		return null;
	}
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		const a = sorted[mid - 1];
		const b = sorted[mid];
		if (a === undefined || b === undefined) {
			return null;
		}
		return (a + b) / 2;
	}
	const single = sorted[mid];
	return single === undefined ? null : single;
}

function daysBetween(a: Date, b: Date): number {
	return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const lifecycle = analyticsProcedure
	.route({
		method: "GET",
		path: "/admin/analytics/lifecycle",
		tags: ["Administration"],
		summary: "User lifecycle and cohort analytics",
	})
	.input(
		z.object({
			months: z.number().int().min(3).max(24).default(12),
		}),
	)
	.handler(async ({ input }) => {
		const { months } = input;
		const now = new Date();
		const startMonth = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
		);

		const users = await db.user.findMany({
			where: { deletedAt: null },
			select: {
				id: true,
				createdAt: true,
				discordConnected: true,
				discordConnectedAt: true,
				purchases: {
					where: { deletedAt: null, type: "SUBSCRIPTION" },
					orderBy: { createdAt: "asc" },
					take: 1,
					select: { createdAt: true },
				},
			},
		});

		const signupsByMonth: { month: string; count: number }[] = [];
		for (let i = 0; i < months; i++) {
			const d = new Date(
				Date.UTC(
					startMonth.getUTCFullYear(),
					startMonth.getUTCMonth() + i,
					1,
				),
			);
			const y = d.getUTCFullYear();
			const m = d.getUTCMonth();
			const monthStart = new Date(Date.UTC(y, m, 1));
			const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
			const key = monthKey(d);
			const count = users.filter(
				(u) => u.createdAt >= monthStart && u.createdAt <= monthEnd,
			).length;
			signupsByMonth.push({ month: key, count });
		}

		const daysToFirstPurchase: number[] = [];
		for (const u of users) {
			const first = u.purchases[0];
			if (!first) {
				continue;
			}
			const d = daysBetween(u.createdAt, first.createdAt);
			if (d >= 0) {
				daysToFirstPurchase.push(d);
			}
		}
		daysToFirstPurchase.sort((a, b) => a - b);

		const daysToDiscord: number[] = [];
		for (const u of users) {
			if (!u.discordConnected || !u.discordConnectedAt) {
				continue;
			}
			const d = daysBetween(u.createdAt, u.discordConnectedAt);
			if (d >= 0) {
				daysToDiscord.push(d);
			}
		}
		daysToDiscord.sort((a, b) => a - b);

		const withPurchase = users.filter((u) => u.purchases.length > 0).length;
		const withDiscord = users.filter((u) => u.discordConnected).length;
		const funnel = {
			signedUp: users.length,
			subscribed: withPurchase,
			discordConnected: withDiscord,
		};

		const cohortRows: {
			cohortMonth: string;
			signups: number;
			withActiveSub: number;
			retentionPercent: number | null;
		}[] = [];

		const activeUserIds = new Set(
			(
				await db.purchase.findMany({
					where: {
						type: "SUBSCRIPTION",
						deletedAt: null,
						status: { in: [...SUBSCRIBER_STATUSES] },
						userId: { not: null },
					},
					select: { userId: true },
				})
			)
				.map((p) => p.userId)
				.filter((id): id is string => id != null),
		);

		for (let i = 0; i < months; i++) {
			const d = new Date(
				Date.UTC(
					startMonth.getUTCFullYear(),
					startMonth.getUTCMonth() + i,
					1,
				),
			);
			const y = d.getUTCFullYear();
			const m = d.getUTCMonth();
			const monthStart = new Date(Date.UTC(y, m, 1));
			const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
			const key = monthKey(d);
			const cohortUsers = users.filter(
				(u) => u.createdAt >= monthStart && u.createdAt <= monthEnd,
			);
			const signups = cohortUsers.length;
			const withActiveSub = cohortUsers.filter((u) =>
				activeUserIds.has(u.id),
			).length;
			cohortRows.push({
				cohortMonth: key,
				signups,
				withActiveSub,
				retentionPercent:
					signups > 0
						? Math.round((1000 * withActiveSub) / signups) / 10
						: null,
			});
		}

		return {
			signupsByMonth,
			medianDaysToFirstPurchase: median(daysToFirstPurchase),
			medianDaysToDiscordConnect: median(daysToDiscord),
			signupFunnel: funnel,
			cohortRetention: cohortRows,
		};
	});
