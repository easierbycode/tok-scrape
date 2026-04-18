import posthog from "posthog-js";
import { isPostHogCaptureEnabled } from "@/lib/posthog";

/**
 * Phase 5 product usage events (PostHog). Names must stay stable for dashboards.
 * Do not send PII (email, name, etc.) in properties.
 */
export const POSTHOG_PRODUCT_EVENTS = {
	AFFILIATE_CTA_CLICKED: "affiliate_cta_clicked",
	DISCORD_CONNECT_STARTED: "discord_connect_started",
	DISCORD_CONNECT_COMPLETED: "discord_connect_completed",
	BILLING_PORTAL_OPENED: "billing_portal_opened",
	HELP_ARTICLE_VIEWED: "help_article_viewed",
	HELP_ARTICLE_VOTED: "help_article_voted",
	ANNOUNCEMENT_ENGAGED: "announcement_engaged",
	ANNOUNCEMENT_DISMISSED: "announcement_dismissed",
} as const;

export function capturePostHogProductEvent(
	event: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined" || !isPostHogCaptureEnabled()) {
		return;
	}
	posthog.capture(event, properties);
}
