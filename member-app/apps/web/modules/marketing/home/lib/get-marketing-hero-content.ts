import { getCachedMarketingContent } from "@marketing/lib/marketing-content-cache";
import { config } from "@repo/config";

const defaults = {
	badgeText: "Built for Creators Who Mean Business",
	headline: "Learn. Build. Earn.",
	subheadline:
		"LifePreneur is where serious entrepreneurs come to sharpen their skills, stay ahead of what's working, and build businesses that last.",
	ctaText: "Join LifePreneur",
} as const;

const defaultThumbnailPath = "/images/hero-thumbnail.jpg";

function resolveThumbnailSrc(raw: string | null | undefined): string {
	const val = raw?.trim();
	if (!val) {
		return defaultThumbnailPath;
	}
	if (val.startsWith("http://") || val.startsWith("https://")) {
		return val;
	}
	if (val.startsWith("/")) {
		return val;
	}
	return `/image-proxy/${config.storage.bucketNames.marketing}/${val}`;
}

export interface MarketingHeroContent {
	badgeText: string;
	headline: string;
	headlineAccent: string | null;
	subheadline: string;
	ctaText: string;
	videoUrl: string | null;
	thumbnailSrc: string;
}

export async function getMarketingHeroContent(): Promise<MarketingHeroContent> {
	const row = await getCachedMarketingContent();

	return {
		badgeText: row?.heroBadgeText?.trim() || defaults.badgeText,
		headline: row?.heroHeadline?.trim() || defaults.headline,
		headlineAccent: row?.heroHeadlineAccent?.trim() || null,
		subheadline: row?.heroSubheadline?.trim() || defaults.subheadline,
		ctaText: row?.heroCtaText?.trim() || defaults.ctaText,
		videoUrl: row?.heroVideoUrl?.trim() || null,
		thumbnailSrc: resolveThumbnailSrc(row?.heroThumbnailUrl),
	};
}
