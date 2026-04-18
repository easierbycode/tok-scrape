export interface AffiliateData {
	id: string;
	customLinkSlug: string;
	totalReferrals: number;
	totalEarnings: number;
	totalClicks: number;
	totalLeads: number;
	totalConversions: number;
	conversionRate: number;
	pendingEarnings: number;
	dueEarnings: number;
	paidEarnings: number;
	payoutEmail: string;
	payoutMethod: string;
}

export interface EarningsBreakdown {
	pending: number;
	due: number;
	paid: number;
	total: number;
}

export interface ReferralPipeline {
	visitors: number;
	leads: number;
	conversions: number;
	signupRate: string;
	conversionRate: string;
}

export interface OnboardingStep {
	id: number;
	title: string;
	completed: boolean;
}
