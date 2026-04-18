/**
 * PostHog browser client (initialized in `PostHogProvider`).
 * Import `posthog` only from client components after init.
 */
export const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";

/** Only true on Vercel Production (`VERCEL_ENV=production`). Preview and local never capture. */
export function isPostHogCaptureEnabled(): boolean {
	if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
		return false;
	}
	return process.env.NEXT_PUBLIC_VERCEL_ENV === "production";
}
