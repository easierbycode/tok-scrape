import { db } from "@repo/database";
import { z } from "zod";
import { analyticsProcedure } from "../../../../orpc/procedures";

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

function monthKey(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

function endOfUtcMonth(year: number, monthIndex0: number): Date {
	return new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
}

function isSubscriptionActiveAt(
	p: {
		createdAt: Date;
		cancelledAt: Date | null;
		cachedAmount: number | null;
	},
	end: Date,
): boolean {
	if (!p.cachedAmount || p.cachedAmount <= 0) {
		return false;
	}
	if (p.createdAt > end) {
		return false;
	}
	if (p.cancelledAt && p.cancelledAt <= end) {
		return false;
	}
	return true;
}

export const revenue = analyticsProcedure
	.route({
		method: "GET",
		path: "/admin/analytics/revenue",
		tags: ["Administration"],
		summary: "Revenue and subscription analytics",
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

		const [activePurchases, allSubscriptionPurchases] = await Promise.all([
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
					productId: true,
					rewardfulReferralId: true,
				},
			}),
			db.purchase.findMany({
				where: {
					type: "SUBSCRIPTION",
					deletedAt: null,
				},
				select: {
					createdAt: true,
					cancelledAt: true,
					cachedAmount: true,
					cachedInterval: true,
					productId: true,
					rewardfulReferralId: true,
				},
			}),
		]);

		const currentMrrCents = activePurchases.reduce(
			(sum, p) =>
				sum +
				monthlyEquivalentCents(
					p.cachedAmount ?? 0,
					p.cachedInterval ?? "month",
				),
			0,
		);

		const mrrByMonth: { month: string; mrrCents: number }[] = [];
		const newSubsByMonth: { month: string; count: number }[] = [];
		const churnedByMonth: { month: string; count: number }[] = [];

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
			const end = endOfUtcMonth(y, m);
			const key = monthKey(d);

			let mrr = 0;
			for (const p of allSubscriptionPurchases) {
				if (!isSubscriptionActiveAt(p, end)) {
					continue;
				}
				mrr += monthlyEquivalentCents(
					p.cachedAmount ?? 0,
					p.cachedInterval ?? "month",
				);
			}
			mrrByMonth.push({ month: key, mrrCents: mrr });

			const monthStart = new Date(Date.UTC(y, m, 1));
			const monthEnd = endOfUtcMonth(y, m);
			const newCount = allSubscriptionPurchases.filter(
				(p) => p.createdAt >= monthStart && p.createdAt <= monthEnd,
			).length;
			newSubsByMonth.push({ month: key, count: newCount });

			const churnCount = allSubscriptionPurchases.filter(
				(p) =>
					p.cancelledAt !== null &&
					p.cancelledAt >= monthStart &&
					p.cancelledAt <= monthEnd,
			).length;
			churnedByMonth.push({ month: key, count: churnCount });
		}

		const planCounts = new Map<string, number>();
		for (const p of activePurchases) {
			const id = p.productId || "unknown";
			planCounts.set(id, (planCounts.get(id) ?? 0) + 1);
		}
		const planDistribution = [...planCounts.entries()].map(
			([productId, count]) => ({
				productId,
				count,
			}),
		);

		let withAffiliate = 0;
		let direct = 0;
		for (const p of activePurchases) {
			if (p.rewardfulReferralId) {
				withAffiliate++;
			} else {
				direct++;
			}
		}

		return {
			currentMrrCents,
			mrrByMonth,
			newSubscribersByMonth: newSubsByMonth,
			churnedByMonth,
			planDistribution,
			affiliateVsDirect: {
				withAffiliateReferral: withAffiliate,
				direct,
			},
		};
	});
