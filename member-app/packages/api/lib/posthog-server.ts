import { PostHog } from "posthog-node";

let posthogServer: PostHog | null = null;

/**
 * Optional server-side PostHog client for API-side capture (Phase 5+).
 * Set `POSTHOG_API_KEY` or reuse `NEXT_PUBLIC_POSTHOG_KEY` in server env.
 */
export function getPostHogServer(): PostHog | null {
	if (process.env.VERCEL_ENV !== "production") {
		return null;
	}

	const apiKey =
		process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
	const host =
		process.env.POSTHOG_HOST ??
		process.env.NEXT_PUBLIC_POSTHOG_HOST ??
		"https://us.i.posthog.com";

	if (!apiKey) {
		return null;
	}

	if (!posthogServer) {
		posthogServer = new PostHog(apiKey, { host });
	}

	return posthogServer;
}
