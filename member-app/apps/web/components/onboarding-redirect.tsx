"use client";

import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client-side onboarding redirect component
 *
 * Redirects authenticated users with incomplete onboarding to the onboarding flow.
 * Uses the useSession hook to wait for session to be loaded before checking.
 *
 * Note: Server-side redirect is handled in app/layout.tsx for initial page load.
 * This component handles client-side navigation within the app.
 */
export function OnboardingRedirect() {
	const router = useRouter();
	const { user, loaded } = useSession();

	useEffect(() => {
		// Wait for session to load before checking
		if (!loaded) {
			return;
		}

		// Redirect to onboarding if user hasn't completed it
		const userWithOnboarding = user as typeof user & {
			onboardingComplete?: boolean;
		};
		if (
			userWithOnboarding &&
			config.users.enableOnboarding &&
			!(userWithOnboarding.onboardingComplete ?? false)
		) {
			router.push("/onboarding?step=1");
		}
	}, [user, loaded, router]);

	return null;
}
