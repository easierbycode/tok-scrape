import type { AffiliateType as Affiliate } from "@repo/database/prisma/zod";
import type { AffiliateWithMetrics } from "../modules/admin/types";
import type {
	RewardfulAffiliate,
	RewardfulAffiliateDetails,
	RewardfulCommission,
} from "./rewardful-client";

/**
 * Map Rewardful's basic data structure to the detailed AffiliateWithMetrics interface
 * expected by the frontend.
 *
 * Uses real Rewardful API fields:
 * - visitors, leads, conversions from list endpoint
 * - commissions for earnings breakdown (if provided)
 * - links from details endpoint (if provided)
 */
export function mapRewardfulToAffiliateWithMetrics(
	rewardful: RewardfulAffiliate,
	dbAffiliate?: Affiliate & { user?: { name: string; email: string } },
	details?: RewardfulAffiliateDetails,
	commissions?: RewardfulCommission[],
): AffiliateWithMetrics {
	// Map Rewardful's actual states: active | disabled | suspicious
	const statusMap: Record<string, "active" | "disabled" | "suspicious"> = {
		active: "active",
		disabled: "disabled",
		suspicious: "suspicious",
	};

	const status = statusMap[rewardful.state] || "disabled";

	// Calculate earnings from commissions (most granular) → commission_stats (from list) → DB fallback
	let totalEarnings = 0;
	let pendingEarnings = 0;
	let approvedEarnings = 0;
	let paidEarnings = 0;
	let grossRevenue = 0;

	if (commissions) {
		// Most accurate: individual commission records from detail fetch
		for (const commission of commissions) {
			const amount = commission.amount / 100;
			totalEarnings += amount;

			if (commission.state === "pending") {
				pendingEarnings += amount;
			} else if (commission.state === "due") {
				approvedEarnings += amount;
			} else if (commission.state === "paid") {
				paidEarnings += amount;
			}
		}
	} else if (rewardful.commission_stats) {
		// Commission totals from expand[]=commission_stats on the list endpoint.
		// Structure: { currencies: { USD: { unpaid, due, paid, total, gross_revenue } } }
		// "due" = approved and ready for payout; "unpaid" = due + pending combined.
		const usd = rewardful.commission_stats.currencies?.USD;
		if (usd) {
			const unpaidCents = usd.unpaid?.cents ?? 0;
			const dueCents = usd.due?.cents ?? 0;
			paidEarnings = (usd.paid?.cents ?? 0) / 100;
			approvedEarnings = dueCents / 100;
			pendingEarnings = Math.max(0, unpaidCents - dueCents) / 100;
			totalEarnings = (usd.total?.cents ?? 0) / 100;
			grossRevenue = (usd.gross_revenue?.cents ?? 0) / 100;
		}
	} else if (dbAffiliate) {
		// Fallback to DB (from last sync) when commission_stats is not available
		totalEarnings = (dbAffiliate.commissionsEarned || 0) / 100;
		pendingEarnings = (dbAffiliate.commissionsPending || 0) / 100;
		paidEarnings = (dbAffiliate.commissionsPaid || 0) / 100;
	}

	// True conversion rate: paying customers ÷ unique visitors
	const conversionRate =
		rewardful.visitors > 0
			? (rewardful.conversions / rewardful.visitors) * 100
			: 0;

	// Get name from database if available, otherwise construct from Rewardful
	const name =
		dbAffiliate?.user?.name ||
		`${rewardful.first_name || ""} ${rewardful.last_name || ""}`.trim() ||
		rewardful.email.split("@")[0];

	// Get tracking links from details if available
	const trackingLinks =
		details?.links?.map((link) => ({
			url: link.url,
			clicks: link.visitors || 0,
		})) || [];

	return {
		id: dbAffiliate?.id || `temp-${rewardful.id}`,
		userId: dbAffiliate?.userId || `no-user-${rewardful.id}`,
		name,
		email: rewardful.email,
		rewardfulId: rewardful.id,
		joinDate: rewardful.created_at,
		status,
		lastActivity: rewardful.updated_at,
		lastSyncAt: dbAffiliate?.lastSyncAt?.toISOString() ?? null,

		// Account status
		hasUserAccount: !!dbAffiliate,

		// User account info (from database)
		userAccountName: dbAffiliate?.user?.name,
		userAccountEmail: dbAffiliate?.user?.email,

		// Real metrics from Rewardful
		totalClicks: rewardful.visitors,
		clickTrend: 0, // Would need historical data
		conversions: rewardful.conversions,
		conversionRate: Number(conversionRate.toFixed(1)),

		// Real earnings from commissions
		totalEarnings,
		pendingEarnings,
		dueEarnings: approvedEarnings,
		paidEarnings,
		grossRevenue,

		// Links from details
		trackingLinks,

		// Recent referrals (empty for now - would need separate endpoint)
		recentReferrals: [],
	};
}
