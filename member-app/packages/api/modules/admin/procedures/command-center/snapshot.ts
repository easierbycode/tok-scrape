import { db } from "@repo/database";
import { z } from "zod";
import { ownerProcedure } from "../../../../orpc/procedures";

const SUBSCRIBER_STATUSES = ["active", "trialing", "grace_period"] as const;

function monthlyEquivalentCents(
	cachedAmount: number,
	cachedInterval: string | null | undefined,
): number {
	if (!cachedInterval || cachedInterval === "month") {
		return cachedAmount;
	}
	if (cachedInterval === "year") {
		return Math.round(cachedAmount / 12);
	}
	return cachedAmount;
}

function userProfileHref(email: string): string {
	return `/admin/users?query=${encodeURIComponent(email)}`;
}

export const snapshot = ownerProcedure
	.route({
		method: "GET",
		path: "/admin/command-center/snapshot",
		tags: ["Administration"],
		summary: "Command center watchlist, system signals, and MRR snapshot",
	})
	.input(z.object({}))
	.handler(async () => {
		const now = new Date();
		const fourteenDaysAgo = new Date(now);
		fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
		const sevenDaysAgo = new Date(now);
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const sevenDaysFromNow = new Date(now);
		sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

		const activeSubscriberSelect = {
			id: true,
			userId: true,
			status: true,
			currentPeriodEnd: true,
			cancelAtPeriodEnd: true,
			cancelledAt: true,
			createdAt: true,
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					deletedAt: true,
					discordConnected: true,
				},
			},
		} as const;

		const [
			gracePurchases,
			recentlyCanceled,
			expiringScheduledCancels,
			mrrPurchases,
			graceExpirySignal,
			stripeSyncedAggregate,
			webhookTypeActivity,
			discordIssueNotice,
		] = await Promise.all([
			db.purchase.findMany({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
					status: "grace_period",
					userId: { not: null },
					user: { deletedAt: null },
				},
				select: activeSubscriberSelect,
				orderBy: { currentPeriodEnd: "asc" },
				take: 50,
			}),
			db.purchase.findMany({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
					cancelledAt: { gte: fourteenDaysAgo },
					userId: { not: null },
					user: { deletedAt: null },
				},
				select: activeSubscriberSelect,
				orderBy: { cancelledAt: "desc" },
				take: 50,
			}),
			db.purchase.findMany({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
					cancelAtPeriodEnd: true,
					status: { in: [...SUBSCRIBER_STATUSES] },
					currentPeriodEnd: {
						gte: now,
						lte: sevenDaysFromNow,
					},
					userId: { not: null },
					user: { deletedAt: null },
				},
				select: activeSubscriberSelect,
				orderBy: { currentPeriodEnd: "asc" },
				take: 50,
			}),
			db.purchase.findMany({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
					status: { in: [...SUBSCRIBER_STATUSES] },
					cachedAmount: { not: null },
				},
				select: {
					cachedAmount: true,
					cachedInterval: true,
				},
			}),
			db.discordAudit.findFirst({
				where: { reason: "grace_period_expired" },
				orderBy: { createdAt: "desc" },
				select: { createdAt: true },
			}),
			db.purchase.aggregate({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
					subscriptionId: { not: null },
				},
				_max: { stripeSyncedAt: true },
			}),
			db.webhookEvent.groupBy({
				by: ["type"],
				where: { processed: true },
				_max: { createdAt: true },
				orderBy: { _max: { createdAt: "desc" } },
				take: 12,
			}),
			db.notification.findFirst({
				where: {
					OR: [
						{ title: "Discord Health Check Alert" },
						{ title: "Discord Sync Issues Detected" },
					],
				},
				orderBy: { createdAt: "desc" },
				select: {
					createdAt: true,
					title: true,
					message: true,
					type: true,
				},
			}),
		]);

		const noDiscordAfterSevenDays = await db.purchase.findMany({
			where: {
				type: "SUBSCRIPTION",
				deletedAt: null,
				status: { in: [...SUBSCRIBER_STATUSES] },
				createdAt: { lte: sevenDaysAgo },
				userId: { not: null },
				user: {
					deletedAt: null,
					discordConnected: false,
				},
			},
			select: activeSubscriberSelect,
			orderBy: { createdAt: "asc" },
			take: 50,
		});

		const mapPurchaseRows = (
			rows: typeof gracePurchases,
			extra?: (p: (typeof gracePurchases)[0]) => Record<string, unknown>,
		) =>
			rows
				.filter((p) => p.user && !p.user.deletedAt)
				.map((p) => ({
					purchaseId: p.id,
					userId: p.userId as string,
					name: p.user?.name ?? "—",
					email: p.user?.email ?? "—",
					href: userProfileHref(p.user?.email ?? ""),
					status: p.status,
					currentPeriodEnd: p.currentPeriodEnd?.toISOString() ?? null,
					cancelledAt: p.cancelledAt?.toISOString() ?? null,
					...(extra ? extra(p) : {}),
				}));

		const currentMrrCents = mrrPurchases.reduce(
			(sum, p) =>
				sum +
				monthlyEquivalentCents(
					p.cachedAmount ?? 0,
					p.cachedInterval ?? "month",
				),
			0,
		);

		const lastStripeSyncAt = stripeSyncedAggregate._max.stripeSyncedAt;

		return {
			mrrCents: currentMrrCents,
			watchlist: {
				gracePeriod: mapPurchaseRows(gracePurchases),
				canceledLast14Days: mapPurchaseRows(recentlyCanceled),
				subscribedNoDiscordAfter7Days: mapPurchaseRows(
					noDiscordAfterSevenDays,
				),
				cancelAtPeriodEndWithin7Days: mapPurchaseRows(
					expiringScheduledCancels,
					(p) => ({
						cancelAtPeriodEnd: p.cancelAtPeriodEnd,
					}),
				),
			},
			systemStatus: {
				cronSignals: [
					{
						id: "sync-stripe-subscriptions",
						label: "Stripe subscription sync (cron)",
						lastRunAt: lastStripeSyncAt?.toISOString() ?? null,
						detail:
							lastStripeSyncAt == null
								? "No stripeSyncedAt on subscription purchases yet."
								: "Latest purchase Stripe sync timestamp in DB.",
					},
					{
						id: "grace-period-expiration",
						label: "Grace period expiration (cron)",
						lastRunAt:
							graceExpirySignal?.createdAt.toISOString() ?? null,
						detail:
							graceExpirySignal == null
								? "No grace-period Discord kicks recorded (cron may not have fired or had no work)."
								: "Last Discord removal logged with reason grace_period_expired.",
					},
					{
						id: "purge-deleted-users",
						label: "Purge deleted users (cron)",
						lastRunAt: null,
						detail: "Purge job does not write a DB heartbeat; confirm runs in Vercel cron logs.",
					},
					{
						id: "discord-health-check",
						label: "Discord health check (cron)",
						lastRunAt: null,
						detail: "No DB heartbeat; failures may create admin notifications (see below).",
					},
				],
				stripeWebhooks: webhookTypeActivity.map((w) => ({
					type: w.type,
					lastProcessedAt: w._max.createdAt?.toISOString() ?? null,
				})),
				discordIssueNotification: discordIssueNotice
					? {
							createdAt:
								discordIssueNotice.createdAt.toISOString(),
							title: discordIssueNotice.title,
							type: discordIssueNotice.type,
							messagePreview: discordIssueNotice.message.slice(
								0,
								240,
							),
						}
					: null,
			},
		};
	});
