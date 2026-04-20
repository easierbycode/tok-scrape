import { config } from "@repo/config";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";
import type {
	SubscriptionStats,
	SubscriptionsOverview,
	SubscriptionWithUser,
} from "../../types";

export const subscriptionsOverview = adminProcedure
	.route({
		method: "GET",
		path: "/admin/subscriptions/overview",
		tags: ["Administration"],
		summary: "Get subscriptions overview with stats",
	})
	.input(
		z
			.object({
				searchTerm: z.string().optional(),
				filter: z
					.enum(["all", "active", "trial", "free", "inactive"])
					.optional(),
			})
			.optional(),
	)
	.handler(async ({ input }) => {
		const { searchTerm, filter } = input || {};

		// ALWAYS fetch ALL purchases for stats calculation
		const allPurchases = await db.purchase.findMany({
			where: {
				userId: { not: null }, // Only user purchases, not org purchases
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						image: true,
						discordConnected: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		// Calculate stats from ALL purchases (not filtered)
		const stats = calculateStats(allPurchases);

		// Filter purchases for display based on tab
		let purchases = allPurchases;
		if (filter && filter !== "all") {
			purchases = allPurchases.filter((p) => {
				if (filter === "active") {
					return (
						p.status === "active" &&
						p.productId !== MANUAL_OVERRIDE_PRODUCT_ID
					);
				}
				if (filter === "trial") {
					return p.status === "trialing";
				}
				if (filter === "free") {
					return p.productId === MANUAL_OVERRIDE_PRODUCT_ID;
				}
				if (filter === "inactive") {
					return p.status === "canceled";
				}
				return true;
			});
		}

		// Transform to SubscriptionWithUser format
		let subscriptions: SubscriptionWithUser[] = purchases
			.filter((p) => p.user) // Only include purchases with users
			.map((purchase) => {
				const user = purchase.user!;
				// Get amount from cached data (convert cents to dollars)
				const amount = purchase.cachedAmount
					? purchase.cachedAmount / 100
					: 0;
				// Get billing cycle from cached interval
				const billingCycle =
					purchase.cachedInterval === "year"
						? "yearly"
						: purchase.cachedInterval === "month"
							? "monthly"
							: undefined;
				// Get plan name using cached interval if available
				const plan = getPlanName(
					purchase.productId,
					purchase.cachedInterval,
				);
			return {
			id: purchase.id,
			userId: user.id,
			userName: user.name,
			userEmail: user.email,
			userAvatar: user.image || undefined,
				status: purchase.status || "unknown",
				plan,
				amount,
				billingCycle,
				startedAt: purchase.createdAt?.toISOString(),
				nextBilling: purchase.currentPeriodEnd?.toISOString(),
				trialEnd: purchase.trialEnd?.toISOString(),
				customerId: purchase.customerId,
				subscriptionId: purchase.subscriptionId || "",
				couponCode: purchase.cachedCouponId || undefined,
				couponName: purchase.cachedCouponName || undefined,
				discordConnected: user.discordConnected || false,
				productId: purchase.productId,
				canceledAt: purchase.cancelledAt?.toISOString(),
				cancelAtPeriodEnd: purchase.cancelAtPeriodEnd ?? false,
			};
			});

		// Apply search filter
		if (searchTerm) {
			const query = searchTerm.toLowerCase();
			subscriptions = subscriptions.filter(
				(s) =>
					s.userName.toLowerCase().includes(query) ||
					s.userEmail.toLowerCase().includes(query),
			);
		}

		return {
			stats,
			subscriptions,
		} satisfies SubscriptionsOverview;
	});

function getPlanName(productId: string, interval?: string | null): string {
	if (productId === MANUAL_OVERRIDE_PRODUCT_ID) {
		return "Manual Access";
	}

	for (const [planKey, plan] of Object.entries(config.payments.plans)) {
		if (!("prices" in plan) || !plan.prices) continue;
		const matchedPrice = plan.prices.find(
			(p) => p.productId === productId,
		);
		if (matchedPrice) {
			const label =
				planKey.charAt(0).toUpperCase() +
				planKey.slice(1).replace(/_/g, " ");
			if (matchedPrice.type === "one-time") return `${label} (Lifetime)`;
			const intervalLabel =
				matchedPrice.type === "recurring" ? matchedPrice.interval : null;
			return intervalLabel ? `${label} (${intervalLabel}ly)` : label;
		}
	}

	if (interval === "year") return "Yearly";
	if (interval === "month") return "Monthly";
	return "Subscription";
}

function calculateStats(purchases: any[]): SubscriptionStats {
	// Filter active subscriptions (not manual override, not canceled)
	const activeSubscriptions = purchases.filter(
		(p) =>
			p.status === "active" &&
			p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
			p.type === "SUBSCRIPTION",
	);

	// Filter trials
	const trials = purchases.filter((p) => p.status === "trialing");

	// Filter manual/free access
	const freeAccess = purchases.filter(
		(p) => p.productId === MANUAL_OVERRIDE_PRODUCT_ID,
	);

	// Calculate MRR (Monthly Recurring Revenue) from cached Stripe data
	let mrr = 0;
	for (const purchase of activeSubscriptions) {
		// Use cached amount if available (in cents)
		if (purchase.cachedAmount !== null && purchase.cachedAmount !== undefined) {
			const amountInDollars = purchase.cachedAmount / 100;
			const interval = purchase.cachedInterval || "month";

			// Convert to monthly recurring revenue
			if (interval === "year") {
				mrr += amountInDollars / 12; // Annual becomes monthly
			} else if (interval === "month") {
				mrr += amountInDollars; // Already monthly
			}
			// If interval is unknown, skip (shouldn't happen after sync)
		}
		// If no cached data, skip this subscription (will be synced by cron)
	}

	// Round to 2 decimal places
	mrr = Math.round(mrr * 100) / 100;

	// Calculate ARR
	const arr = Math.round(mrr * 12 * 100) / 100;

	// Calculate churn rate (percentage of canceled vs total)
	const canceled = purchases.filter((p) => p.status === "canceled").length;
	const total = purchases.length;
	const churnRate =
		total > 0 ? Math.round((canceled / total) * 100 * 10) / 10 : 0;

	return {
		mrr,
		arr,
		churnRate,
		activeSubscribers: activeSubscriptions.length,
		activeTrials: trials.length,
		freeAccess: freeAccess.length,
		inactiveSubscriptions: canceled,
	};
}
