import { getSession } from "@saas/auth/lib/server";

/**
 * Server-side check for a single beta feature.
 * Use in async Server Components and route handlers.
 */
export async function hasBetaFeature(featureId: string): Promise<boolean> {
	const session = await getSession();
	const betaFeatures =
		(session?.user as { betaFeatures?: string[] } | undefined)
			?.betaFeatures ?? [];
	return betaFeatures.includes(featureId);
}

/**
 * Server-side check for multiple beta features at once.
 * Returns a record of featureId → boolean.
 */
export async function hasBetaFeatures(
	featureIds: string[],
): Promise<Record<string, boolean>> {
	const session = await getSession();
	const betaFeatures =
		(session?.user as { betaFeatures?: string[] } | undefined)
			?.betaFeatures ?? [];

	return Object.fromEntries(
		featureIds.map((id) => [id, betaFeatures.includes(id)]),
	);
}
