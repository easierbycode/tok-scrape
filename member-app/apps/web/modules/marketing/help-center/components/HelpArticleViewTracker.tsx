"use client";

import { useEffect } from "react";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";

interface HelpArticleViewTrackerProps {
	articleId: string;
	categorySlug: string;
	articleSlug: string;
}

/**
 * Fires once per mount when a help article is viewed (client-side).
 */
export function HelpArticleViewTracker({
	articleId,
	categorySlug,
	articleSlug,
}: HelpArticleViewTrackerProps) {
	useEffect(() => {
		capturePostHogProductEvent(POSTHOG_PRODUCT_EVENTS.HELP_ARTICLE_VIEWED, {
			article_id: articleId,
			category_slug: categorySlug,
			article_slug: articleSlug,
		});
	}, [articleId, categorySlug, articleSlug]);

	return null;
}
