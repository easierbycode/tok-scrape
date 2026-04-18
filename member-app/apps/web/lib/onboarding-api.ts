/**
 * Onboarding API Layer
 *
 * Provides a unified interface for onboarding operations.
 * Uses Better-Auth for authentication and session management.
 */

import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { orpcClient } from "@/modules/shared/lib/orpc-client";

const DISCORD_COMPLETE_SESSION_KEY = "lifepreneur_ph_discord_connect_completed";

// Type for user data (from Better-Auth session)
type User = {
	id: string;
	name: string | null;
	firstName?: string | null;
	lastName?: string | null;
	username?: string | null;
	email: string;
	image?: string | null;
	onboardingComplete?: boolean;
	discordId?: string | null;
	discordUsername?: string | null;
	discordConnected?: boolean;
	discordConnectedAt?: Date | null;
};

/**
 * Get current user data
 * Returns null if session is not ready (timing issue on mount)
 * Callers should handle null gracefully
 */
export async function getUser(): Promise<User | null> {
	const { data: session } = await authClient.getSession();
	// Return null instead of throwing - handles client-side hydration timing
	return (session?.user as User) ?? null;
}

/**
 * Update user profile (name, firstName, lastName, etc.)
 * The update itself is the important action - session refresh is best-effort
 */
export async function updateUserProfile(data: {
	name?: string;
	firstName?: string;
	lastName?: string;
	username?: string | null;
	image?: string | null;
}): Promise<User | null> {
	// Perform the update - this is the critical action
	await authClient.updateUser(data);
	// Best-effort session refresh - don't fail if timing issue
	const { data: session } = await authClient.getSession();
	return (session?.user as User) ?? null;
}

/**
 * Mark onboarding as complete
 * Uses server-side ORPC procedure because Better Auth marks onboardingComplete
 * as input:false (not writable via authClient.updateUser).
 */
export async function completeOnboarding(): Promise<User | null> {
	await orpcClient.users.completeOnboarding();
	// Best-effort session refresh so callers get updated user data
	const { data: session } = await authClient.getSession();
	return (session?.user as User) ?? null;
}

/**
 * Connect user's Discord account
 * Initiates Discord OAuth flow - this redirects the user
 * The code after linkSocial won't execute until they return
 */
export async function connectDiscord(): Promise<void> {
	// Initiate Discord OAuth flow
	// This will redirect the user to Discord for authorization
	await authClient.linkSocial({
		provider: "discord",
		callbackURL: window.location.href,
	});
	// Note: User is redirected, so code below this won't run
	// After OAuth callback, the page will reload and session will have Discord data
}

/**
 * Open a Discord channel link, preferring the native app over the web version.
 *
 * Tries the `discord://` deep link first. If the Discord app is installed the
 * OS intercepts it and the page becomes hidden — we detect that via
 * visibilitychange and cancel the web fallback. If the app is not installed
 * the page stays visible and we open the `https://` URL after a short timeout.
 */
export function openDiscordLink(guildId: string, channelId: string): void {
	const appUrl = `discord://discord.com/channels/${guildId}/${channelId}`;
	const webUrl = `https://discord.com/channels/${guildId}/${channelId}`;

	const fallback = setTimeout(() => {
		document.removeEventListener("visibilitychange", onVisibilityChange);
		window.open(webUrl, "_blank");
	}, 1500);

	function onVisibilityChange() {
		if (document.visibilityState === "hidden") {
			clearTimeout(fallback);
			document.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
		}
	}

	document.addEventListener("visibilitychange", onVisibilityChange);
	window.location.href = appUrl;
}

/**
 * Check if Discord is connected
 * Returns false if session not ready or Discord not connected
 */
export async function isDiscordConnected(): Promise<boolean> {
	const user = await getUser();
	return user?.discordConnected ?? false;
}

/**
 * Sync Discord data from Account table to User table
 * Call this after Discord OAuth completes to sync the Discord ID to the user record.
 *
 * @returns Result indicating success or failure with optional error/needsConnection/warning/message
 */
export async function grantDiscordAccess(): Promise<{
	success: boolean;
	error?: string;
	needsConnection?: boolean;
	noSubscription?: boolean;
	message?: string;
	warning?: string;
}> {
	try {
		const result = await orpcClient.users.discord.grantAccess();
		if (
			result.success &&
			typeof window !== "undefined" &&
			!sessionStorage.getItem(DISCORD_COMPLETE_SESSION_KEY)
		) {
			sessionStorage.setItem(DISCORD_COMPLETE_SESSION_KEY, "1");
			capturePostHogProductEvent(
				POSTHOG_PRODUCT_EVENTS.DISCORD_CONNECT_COMPLETED,
			);
		}
		return result;
	} catch (error) {
		logger.error("Failed to grant Discord access", { error });
		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to grant Discord access",
		};
	}
}
