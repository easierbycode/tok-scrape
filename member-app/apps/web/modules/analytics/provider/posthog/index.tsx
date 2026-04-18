"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { isPostHogCaptureEnabled } from "@/lib/posthog";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY as string;

export function AnalyticsScript() {
	useEffect(() => {
		if (!isPostHogCaptureEnabled() || !posthogKey) {
			return;
		}

		const host =
			process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
		posthog.init(posthogKey, {
			api_host: host,
			person_profiles: "identified_only",
		});
	}, []);

	return null;
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		if (!isPostHogCaptureEnabled() || !posthogKey) {
			return;
		}

		posthog.capture(event, data);
	};

	return {
		trackEvent,
	};
}
