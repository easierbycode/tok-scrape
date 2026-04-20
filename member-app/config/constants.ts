/**
 * Shared constants for the application
 * Prevents magic strings and centralizes configuration
 */

// Manual Override Product ID
export const MANUAL_OVERRIDE_PRODUCT_ID = "manual-override";

// Grace Period Configuration
export const GRACE_PERIOD_DAYS = 7;

// Cache TTLs (in milliseconds)
export const CSRF_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const REWARDFUL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Discord Configuration (from environment variables)
export const DISCORD_CONFIG = {
	activeRoleId: process.env.DISCORD_ACTIVE_ROLE_ID!,
	gracePeriodRoleId: process.env.DISCORD_GRACE_PERIOD_ROLE_ID!,
	guildId: process.env.DISCORD_GUILD_ID!,
	/** Optional: removed when a member clicks the onboarding_complete Message Studio preset. */
	notOnboardedRoleId: process.env.DISCORD_NOT_ONBOARDED_ROLE_ID,
} as const;

// Rewardful Configuration
export const REWARDFUL_CONFIG = {
	campaignId: process.env.REWARDFUL_CAMPAIGN_ID!,
	apiSecret: process.env.REWARDFUL_API_SECRET!,
} as const;
