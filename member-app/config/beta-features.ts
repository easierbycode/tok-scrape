/**
 * Beta Feature IDs Registry
 *
 * This file maintains the canonical list of beta feature IDs for type safety.
 * Feature metadata (name, description, dates) is stored in the database and
 * can be edited via the admin UI.
 *
 * When adding a new beta feature:
 * 1. Add the feature ID here
 * 2. Run the seed script or manually add to database via admin UI
 * 3. Implement the feature with useBetaFeature("yourFeatureId")
 */

export const BETA_FEATURE_IDS = {
	FULL_AFFILIATE_DASHBOARD: "fullAffiliateDashboard",
	ENHANCED_VIDEO_PLAYER: "enhancedVideoPlayer",
	TIKTOK_DASHBOARD_BETA: "tiktokDashboardBeta",
} as const;

// Type-safe feature IDs for use in code
export type BetaFeatureId =
	(typeof BETA_FEATURE_IDS)[keyof typeof BETA_FEATURE_IDS];
