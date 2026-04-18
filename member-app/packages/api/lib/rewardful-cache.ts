import { REWARDFUL_CACHE_TTL } from "@repo/config/constants";
import { logger } from "@repo/logs";
import {
	fetchRewardfulAffiliates,
	type RewardfulAffiliate,
} from "./rewardful-client";

interface CacheEntry {
	data: RewardfulAffiliate[];
	timestamp: number;
}

// In-memory cache (resets on server restart)
let cache: CacheEntry | null = null;

/**
 * Get cached Rewardful affiliates or fetch fresh data
 *
 * @param forceRefresh - Bypass cache and fetch fresh data
 * @returns Affiliates and cache metadata
 */
export async function getCachedRewardfulAffiliates(
	forceRefresh = false,
): Promise<{
	affiliates: RewardfulAffiliate[];
	fromCache: boolean;
	cacheAge: number; // seconds since last fetch
}> {
	const now = Date.now();

	// Check cache validity
	const isCacheValid =
		cache !== null &&
		!forceRefresh &&
		now - cache.timestamp < REWARDFUL_CACHE_TTL;

	if (isCacheValid && cache !== null) {
		const cacheAge = Math.floor((now - cache.timestamp) / 1000);

		logger.info("Returning cached Rewardful data", {
			count: cache.data.length,
			cacheAge,
		});

		return {
			affiliates: cache.data,
			fromCache: true,
			cacheAge,
		};
	}

	// Fetch fresh data
	logger.info("Fetching fresh Rewardful data", {
		reason: forceRefresh ? "force_refresh" : "cache_expired",
	});

	try {
		const affiliates = await fetchRewardfulAffiliates();

		// Update cache
		cache = {
			data: affiliates,
			timestamp: now,
		};

		logger.info("Cached Rewardful data", {
			count: affiliates.length,
		});

		return {
			affiliates,
			fromCache: false,
			cacheAge: 0,
		};
	} catch (error) {
		logger.error("Failed to fetch Rewardful data", { error });

		// If cache exists (even if stale), return it
		if (cache !== null) {
			const cacheAge = Math.floor((now - cache.timestamp) / 1000);

			logger.warn("Returning stale cache due to API error", {
				cacheAge,
			});

			return {
				affiliates: cache.data,
				fromCache: true,
				cacheAge,
			};
		}

		// No cache, throw error
		throw error;
	}
}

/**
 * Clear cache (for testing)
 */
export function clearRewardfulCache(): void {
	cache = null;
	logger.info("Cleared Rewardful cache");
}
