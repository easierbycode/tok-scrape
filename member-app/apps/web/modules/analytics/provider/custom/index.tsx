"use client";

import { logger } from "@repo/logs";

export function AnalyticsScript() {
	// return your script here
	return null;
}

export function useAnalytics() {
	const trackEvent = (event: string, data: Record<string, unknown>) => {
		// call your analytics service to track a custom event here
		if (process.env.NODE_ENV === "development") {
			logger.debug("tracking event", { event, data });
		}
	};

	return {
		trackEvent,
	};
}
