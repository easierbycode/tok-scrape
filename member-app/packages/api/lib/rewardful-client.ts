import { logger } from "@repo/logs";

const REWARDFUL_API_BASE = "https://api.getrewardful.com/v1";

export interface RewardfulAffiliate {
	id: string;
	email: string;
	first_name: string | null;
	last_name: string | null;
	state: "active" | "pending" | "suspended";
	created_at: string;
	updated_at: string;
	confirmed_at: string | null;

	// Payment info
	paypal_email: string | null;
	paypal_email_confirmed_at: string | null;
	wise_email: string | null;
	wise_email_confirmed_at: string | null;
	stripe_customer_id: string | null;
	stripe_account_id: string | null;

	// Metrics (available in list)
	visitors: number;
	leads: number;
	conversions: number;
	sign_in_count: number;

	// Notifications
	receive_new_commission_notifications: boolean;
	unconfirmed_email: string | null;

	// Commission stats (available when expanded with expand[]=commission_stats)
	// Structure confirmed from live API: nested by currency ISO code
	commission_stats?: {
		currencies?: {
			[currencyIso: string]: {
				unpaid?: { cents: number; currency_iso: string };
				due?: { cents: number; currency_iso: string };
				paid?: { cents: number; currency_iso: string };
				total?: { cents: number; currency_iso: string };
				gross_revenue?: { cents: number; currency_iso: string };
				net_revenue?: { cents: number; currency_iso: string };
			};
		};
	} | null;
}

export interface RewardfulPagination {
	previous_page: number | null;
	current_page: number;
	next_page: number | null;
	count: number;
	limit: number;
	total_pages: number;
	total_count: number;
}

export interface RewardfulPaginationResponse {
	pagination: RewardfulPagination;
	data: RewardfulAffiliate[];
}

export interface RewardfulReferralsListResponse {
	pagination: RewardfulPagination;
	data: RewardfulReferral[];
}

export interface RewardfulAffiliateDetails extends RewardfulAffiliate {
	// Note: token is NOT at the top level - it's in the links array
	links: Array<{
		id: string;
		url: string;
		token: string;
		created_at: string;
		visitors: number;
		leads: number;
		conversions: number;
	}>;
	campaign?: {
		id: string;
		name: string;
	};
}

export interface RewardfulCommission {
	id: string;
	affiliate_id: string;
	referral_id: string;
	amount: number; // In cents
	state: "pending" | "due" | "paid" | "voided";
	created_at: string;
	updated_at: string;
	paid_at: string | null;
}

export interface RewardfulSale {
	id: string;
	currency: string;
	charged_at: string;
	charge_amount_cents: number;
	sale_amount_cents: number;
	referral: {
		customer: {
			name: string;
			email: string;
			id: string;
		};
	} | null;
}

export interface RewardfulCommissionWithSale {
	id: string;
	amount: number; // Affiliate commission in cents
	currency: string;
	state: "pending" | "due" | "paid" | "voided";
	paid_at: string | null;
	created_at: string;
	updated_at: string;
	sale: RewardfulSale | null;
}

export interface RewardfulReferral {
	id: string;
	stripe_account_id: string | null;
	stripe_customer_id: string | null;
	conversion_state: "visitor" | "lead" | "conversion";
	deactivated_at: string | null;
	expires_at: string;
	created_at: string;
	updated_at: string;
	became_lead_at: string | null;
	became_conversion_at: string | null;
	customer: {
		email?: string;
		first_name?: string;
		last_name?: string;
	} | null;
	visits: number;
	link: {
		id: string;
		url: string;
		token: string;
		visitors: number;
		leads: number;
		conversions: number;
	};
	/** Present when listing with expand[]=affiliate */
	affiliate?: {
		id: string;
		email?: string;
		first_name?: string | null;
		last_name?: string | null;
	};
}

/**
 * Fetch all affiliates from Rewardful API
 * Handles pagination automatically
 */
export async function fetchRewardfulAffiliates(): Promise<
	RewardfulAffiliate[]
> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const allAffiliates: RewardfulAffiliate[] = [];
	let currentPage = 1;
	let hasMore = true;

	while (hasMore) {
		try {
			const response = await fetch(
				`${REWARDFUL_API_BASE}/affiliates?page=${currentPage}&per_page=100&expand[]=commission_stats`,
				{
					headers: {
						Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
						"Content-Type": "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`Rewardful API error: ${response.status} ${response.statusText}`,
				);
			}

			const result: RewardfulPaginationResponse = await response.json();

			// Handle Rewardful's actual pagination structure
			if (result.data && Array.isArray(result.data)) {
				allAffiliates.push(...result.data);

				// Check if more pages using pagination object
				if (result.pagination && result.pagination.next_page !== null) {
					hasMore = true;
					currentPage = result.pagination.next_page;
				} else {
					hasMore = false;
				}

				logger.info("Fetched Rewardful page", {
					page: result.pagination.current_page,
					count: result.data.length,
					total: result.pagination.total_count,
					totalPages: result.pagination.total_pages,
					hasMore,
				});
			} else {
				throw new Error(
					`Unexpected Rewardful API response structure: ${JSON.stringify(result)}`,
				);
			}
		} catch (error) {
			logger.error("Failed to fetch Rewardful affiliates", {
				page: currentPage,
				error: error instanceof Error ? error.message : error,
			});
			throw error;
		}
	}

	return allAffiliates;
}

/**
 * Fetch single affiliate by ID (basic, no expansion)
 */
export async function fetchRewardfulAffiliate(
	affiliateId: string,
): Promise<RewardfulAffiliate> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const response = await fetch(
		`${REWARDFUL_API_BASE}/affiliates/${affiliateId}`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`Affiliate not found: ${affiliateId}`);
		}
		throw new Error(`Rewardful API error: ${response.status}`);
	}

	const result = await response.json();
	return result.data;
}

/**
 * Fetch detailed affiliate data with links expanded
 */
export async function fetchRewardfulAffiliateDetails(
	affiliateId: string,
): Promise<RewardfulAffiliateDetails> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const response = await fetch(
		`${REWARDFUL_API_BASE}/affiliates/${affiliateId}?expand[]=links`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		if (response.status === 429) {
			throw new Error(
				"Rewardful rate limit reached. Please wait 30 seconds and try again.",
			);
		}
		if (response.status === 404) {
			throw new Error(`Affiliate not found: ${affiliateId}`);
		}
		throw new Error(`Rewardful API error: ${response.status}`);
	}

	const result = await response.json();

	// Handle both response structures: wrapped in data or direct object
	// Rewardful returns direct object for single affiliate endpoint
	return result.data || result;
}

/**
 * Fetch commissions for an affiliate
 */
export async function fetchRewardfulCommissions(
	affiliateId: string,
	limit = 50,
): Promise<RewardfulCommission[]> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const response = await fetch(
		`${REWARDFUL_API_BASE}/commissions?affiliate_id=${affiliateId}&limit=${limit}`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Rewardful API error: ${response.status}`);
	}

	const result = await response.json();
	return result.data || [];
}

/**
 * Fetch commissions for an affiliate with sale expansion.
 * Returns customer name, sale amount, and commission amount per conversion.
 */
export async function fetchRewardfulCommissionsWithSale(
	affiliateId: string,
	limit = 10,
): Promise<RewardfulCommissionWithSale[]> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const params = new URLSearchParams({
		affiliate_id: affiliateId,
		limit: String(limit),
	});
	params.append("expand[]", "sale");

	const response = await fetch(
		`${REWARDFUL_API_BASE}/commissions?${params.toString()}`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		if (response.status === 429) {
			throw new Error(
				"Rewardful rate limit reached. Please wait 30 seconds and try again.",
			);
		}
		throw new Error(`Rewardful API error: ${response.status}`);
	}

	const result = await response.json();
	return result.data || [];
}

/**
 * Fetch referrals for an affiliate
 */
export async function fetchRewardfulReferrals(
	affiliateId: string,
	limit = 50,
): Promise<RewardfulReferral[]> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const response = await fetch(
		`${REWARDFUL_API_BASE}/referrals?affiliate_id=${affiliateId}&limit=${limit}`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`Rewardful API error: ${response.status}`);
	}

	const result = await response.json();
	return result.data || [];
}

/**
 * Paginate through all referrals in "conversion" state (paying customers).
 * Uses expand[]=affiliate for affiliate display name/email in admin UI.
 *
 * @param updatedSince - Optional ISO 8601 timestamp. When provided the Rewardful
 *   API will only return referrals updated after this date, keeping responses small.
 */
export async function fetchAllConversionReferrals(
	updatedSince?: string,
): Promise<RewardfulReferral[]> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const all: RewardfulReferral[] = [];
	let currentPage = 1;
	let hasMore = true;

	while (hasMore) {
		const params = new URLSearchParams({
			conversion_state: "conversion",
			limit: "100",
			page: String(currentPage),
		});
		params.append("expand[]", "affiliate");
		if (updatedSince) {
			params.set("updated_since", updatedSince);
		}

		const response = await fetch(
			`${REWARDFUL_API_BASE}/referrals?${params.toString()}`,
			{
				headers: {
					Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error(
				`Rewardful API error: ${response.status} ${response.statusText}`,
			);
		}

		const result: RewardfulReferralsListResponse = await response.json();

		if (result.data && Array.isArray(result.data)) {
			all.push(...result.data);

			if (result.pagination?.next_page !== null) {
				hasMore = true;
				currentPage = result.pagination.next_page ?? currentPage + 1;
			} else {
				hasMore = false;
			}

			logger.info("Fetched Rewardful conversion referrals page", {
				page: result.pagination?.current_page,
				count: result.data.length,
				total: result.pagination?.total_count,
			});
		} else {
			throw new Error(
				`Unexpected Rewardful referrals response: ${JSON.stringify(result)}`,
			);
		}
	}

	return all;
}

/**
 * Create a new affiliate in Rewardful
 */
export async function createRewardfulAffiliate({
	email,
	firstName,
	lastName,
	campaignId,
	token,
}: {
	email: string;
	firstName: string;
	lastName: string;
	campaignId: string;
	token?: string; // Optional - Rewardful will generate if not provided
}): Promise<RewardfulAffiliateDetails> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const body: Record<string, string> = {
		email,
		first_name: firstName,
		last_name: lastName,
		campaign_id: campaignId,
	};

	// Only include token if provided (let Rewardful generate if not)
	if (token) {
		body.token = token;
	}

	const response = await fetch(`${REWARDFUL_API_BASE}/affiliates`, {
		method: "POST",
		headers: {
			Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(body).toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		let errorDetails = errorText;

		try {
			const errorJson = JSON.parse(errorText);
			errorDetails = errorJson.details
				? errorJson.details.join(", ")
				: errorJson.error || errorText;
		} catch {
			// Use plain text if not JSON
		}

		logger.error("Failed to create Rewardful affiliate", {
			status: response.status,
			error: errorDetails,
			email,
		});

		throw new Error(`Rewardful API error: ${errorDetails}`);
	}

	const result = await response.json();

	logger.info("Created Rewardful affiliate", {
		affiliateId: result.id,
		email: result.email,
		token: result.links?.[0]?.token,
	});

	return result;
}

/**
 * Generate SSO magic link for affiliate dashboard
 * Link expires in 1 minute - must be used immediately after generation
 */
export async function getRewardfulSSOLink(
	affiliateId: string,
): Promise<{ url: string; expires: string }> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	const response = await fetch(
		`${REWARDFUL_API_BASE}/affiliates/${affiliateId}/sso`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
				"Content-Type": "application/json",
			},
		},
	);

	if (!response.ok) {
		if (response.status === 404) {
			throw new Error(`Affiliate not found in Rewardful: ${affiliateId}`);
		}
		const errorText = await response.text();
		logger.error("Failed to generate Rewardful SSO link", {
			status: response.status,
			error: errorText,
			affiliateId,
		});
		throw new Error(`Rewardful SSO error: ${response.status}`);
	}

	const result = await response.json();

	return {
		url: result.sso.url,
		expires: result.sso.expires,
	};
}

/**
 * Find an existing affiliate by email address
 * Returns the affiliate if found, null if not found
 */
export async function findRewardfulAffiliateByEmail(
	email: string,
): Promise<RewardfulAffiliateDetails | null> {
	const apiSecret = process.env.REWARDFUL_API_SECRET;

	if (!apiSecret) {
		throw new Error("REWARDFUL_API_SECRET not configured");
	}

	try {
		// Use the email filter parameter - returns list with 0 or 1 items
		const response = await fetch(
			`${REWARDFUL_API_BASE}/affiliates?email=${encodeURIComponent(email)}&expand[]=links`,
			{
				headers: {
					Authorization: `Basic ${Buffer.from(`${apiSecret}:`).toString("base64")}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			throw new Error(`Rewardful API error: ${response.status}`);
		}

		const result: RewardfulPaginationResponse = await response.json();

		// Email filter returns exact match, so we expect 0 or 1 result
		if (result.data && result.data.length > 0) {
			const affiliate = result.data[0];
			logger.info("Found existing Rewardful affiliate by email", {
				affiliateId: affiliate.id,
				email: affiliate.email,
			});
			// The list endpoint returns basic data, fetch details with links
			return await fetchRewardfulAffiliateDetails(affiliate.id);
		}

		return null;
	} catch (error) {
		logger.error("Failed to search Rewardful affiliate by email", {
			email,
			error: error instanceof Error ? error.message : error,
		});
		throw error;
	}
}

/**
 * Helper to generate a safe slug from name
 * Returns lowercase, alphanumeric with dashes
 */
export function generateSlugFromName(
	firstName: string,
	lastName: string,
): string {
	const fullName = `${firstName} ${lastName}`.trim();
	return fullName
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "") // Remove special chars
		.replace(/\s+/g, "-") // Replace spaces with dashes
		.replace(/-+/g, "-") // Remove duplicate dashes
		.replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}
