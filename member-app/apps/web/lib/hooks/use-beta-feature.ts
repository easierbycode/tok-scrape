import { useSession } from "@saas/auth/hooks/use-session";

/**
 * Check if current user has access to a beta feature
 * @param featureId - ID of the beta feature (e.g., "fullAffiliateDashboard")
 * @returns true if user has access, false otherwise
 */
export function useBetaFeature(featureId: string): boolean {
	const { user } = useSession();

	if (!user) {
		return false;
	}

	// betaFeatures is an array of strings from the session
	const userWithBetaFeatures = user as typeof user & {
		betaFeatures?: string[];
	};
	const betaFeatures = userWithBetaFeatures.betaFeatures ?? [];
	return betaFeatures.includes(featureId);
}

/**
 * Check multiple beta features at once
 * @param featureIds - Array of feature IDs to check
 * @returns Object with feature IDs as keys and access status as values
 */
export function useBetaFeatures(featureIds: string[]): Record<string, boolean> {
	const { user } = useSession();

	const result: Record<string, boolean> = {};
	const userWithBetaFeatures = user as
		| (typeof user & { betaFeatures?: string[] })
		| null;
	const betaFeatures = userWithBetaFeatures?.betaFeatures ?? [];

	for (const id of featureIds) {
		result[id] = betaFeatures.includes(id);
	}

	return result;
}
