// ============================================================================
// SUBSCRIPTION TYPES
// ============================================================================

export interface SubscriptionWithUser {
	id: string;
	userId: string;
	userName: string;
	userEmail: string;
	userAvatar?: string;
	status: string; // Stripe status: "active" | "trialing" | "canceled" | "past_due" | "unpaid" | "incomplete" | "incomplete_expired" | "paused"
	plan: string;
	amount: number;
	billingCycle?: "monthly" | "yearly";
	startedAt?: string; // ISO date string - when subscription was created
	nextBilling?: string; // ISO date string
	trialEnd?: string; // ISO date string
	customerId: string;
	subscriptionId: string;
	couponCode?: string; // Coupon ID
	couponName?: string; // Friendly coupon name
	discordConnected: boolean;
	productId?: string; // "manual-override" for free access
	canceledAt?: string;
	cancelReason?: string;
	/** True when the customer scheduled cancel (billing portal / cancel at period end). */
	cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionStats {
	mrr: number;
	arr: number;
	churnRate: number;
	activeSubscribers: number;
	activeTrials: number;
	freeAccess: number;
	inactiveSubscriptions: number;
}

export interface SubscriptionsOverview {
	stats: SubscriptionStats;
	subscriptions: SubscriptionWithUser[];
}

// ============================================================================
// QUERY/LIST INPUT TYPES (CRITICAL - For Phases 3-6)
// ============================================================================

export interface SubscriptionsOverviewInput {
	searchTerm?: string;
	filter?: "all" | "active" | "trial" | "free" | "inactive";
}

export interface AffiliatesListInput {
	status?: "active" | "inactive" | "suspended" | "all";
	searchTerm?: string;
	sortBy?: "earnings" | "conversions" | "clicks" | "joinDate";
	page?: number;
	limit?: number;
}

// ============================================================================
// SUBSCRIPTION ACTION INPUT TYPES
// ============================================================================

export interface ApplyCouponInput {
	subscriptionId: string;
	couponCode: string;
	reason: string;
}

export interface ApplyCreditInput {
	customerId: string;
	amount: number;
	reason: string;
}

export interface ChangePlanInput {
	subscriptionId: string;
	newPriceId: string;
	prorate: boolean;
	reason: string;
}

export interface CancelSubscriptionInput {
	subscriptionId: string;
	immediate: boolean;
	reason: string;
}

export interface ExtendTrialInput {
	subscriptionId: string;
	days: number;
	reason: string;
}

export interface ConvertTrialInput {
	subscriptionId: string;
	reason: string;
}

export interface ManageFreeAccessInput {
	userId: string;
	action: "extend" | "convert" | "revoke";
	params: Record<string, any>;
	reason: string;
}

export interface ReactivateSubscriptionInput {
	customerId: string;
	priceId: string;
	includeTrial: boolean;
	reason: string;
}

// ============================================================================
// ANNOUNCEMENT TYPES
// ============================================================================

export interface Announcement {
	id: string;
	title: string;
	contentPreview: string;
	fullContent: string;
	type: string;
	priority: string;
	author: string;
	published: boolean;
	views: number;
	createdAt: string;
	updatedAt: string;
}

export interface AnnouncementStats {
	total: number;
	published: number;
	draft: number;
	totalViews: number;
}

// ============================================================================
// ANNOUNCEMENT INPUT TYPES
// ============================================================================

export interface AnnouncementsListInput {
	searchTerm?: string;
	status?: "all" | "published" | "draft";
	type?:
		| "all"
		| "welcome"
		| "feature"
		| "event"
		| "maintenance"
		| "community";
	priority?: "all" | "normal" | "important" | "urgent";
}

export interface CreateAnnouncementInput {
	title: string;
	contentPreview: string;
	fullContent: string;
	type: "welcome" | "feature" | "event" | "maintenance" | "community";
	priority: "normal" | "important" | "urgent";
	author: string;
	published: boolean;
}

export interface UpdateAnnouncementInput {
	id: string;
	title: string;
	contentPreview: string;
	fullContent: string;
	type: "welcome" | "feature" | "event" | "maintenance" | "community";
	priority: "normal" | "important" | "urgent";
	author: string;
	published: boolean;
}

export interface DeleteAnnouncementInput {
	id: string;
}

// ============================================================================
// AFFILIATE TYPES
// ============================================================================

export interface AffiliateWithMetrics {
	id: string;
	userId: string;
	name: string;
	email: string;
	rewardfulId: string;
	joinDate: string;
	/** Rewardful affiliate state: active | disabled | suspicious */
	status: "active" | "disabled" | "suspicious";
	lastActivity: string;
	/** ISO timestamp of last DB sync — null if never synced */
	lastSyncAt: string | null;

	// Account status
	hasUserAccount: boolean;

	// User account info (from database)
	userAccountName?: string;
	userAccountEmail?: string;

	// Metrics
	totalClicks: number;
	clickTrend: number; // Percentage change
	conversions: number;
	conversionRate: number;

	// Earnings
	totalEarnings: number;
	pendingEarnings: number;
	dueEarnings: number;
	paidEarnings: number;
	grossRevenue: number;

	// Links
	trackingLinks: Array<{
		url: string;
		clicks: number;
	}>;

	// Recent referrals
	recentReferrals: Array<{
		name: string;
		status: "converted" | "pending" | "cancelled";
		date: string;
		amount: number;
	}>;
}

export interface AffiliateStats {
	totalAffiliates: number;
	activeAffiliates: number;
	/** Always the global count across all affiliates — used for the No Account tab badge */
	noAccountCount: number;
	totalClicks: number;
	totalConversions: number;
	totalCommissions: {
		pending: number;
		due: number;
		paid: number;
		total: number;
	};
	grossRevenue: number;
}

// ============================================================================
// AUDIT LOG TYPES
// ============================================================================

export interface AuditLogEntry {
	id: string;
	timestamp: string;
	adminUserId: string;
	adminEmail: string;
	actionType: string;
	targetEntity:
		| "user"
		| "subscription"
		| "announcement"
		| "affiliate"
		| "content";
	targetId: string;
	targetName?: string;
	/** Human-readable line from metadata.summary */
	summary?: string;
	previousValue?: string;
	newValue?: string;
	reason?: string;
	metadata?: Record<string, unknown>;
	ipAddress?: string;
}

export interface CreateAuditLogInput {
	adminUserId: string;
	adminEmail: string;
	actionType: string;
	targetEntity:
		| "user"
		| "subscription"
		| "announcement"
		| "affiliate"
		| "content";
	targetId: string;
	targetName?: string;
	previousValue?: string;
	newValue?: string;
	reason?: string;
	metadata?: Record<string, any>;
	ipAddress?: string;
}

export interface AuditLogListInput {
	actionType?: string;
	adminUserId?: string;
	targetEntity?: string;
	startDate?: string;
	endDate?: string;
	page?: number;
	limit?: number;
}
