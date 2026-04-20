import { getMarketingHeroContent } from "@marketing/home/lib/get-marketing-hero-content";
import { HeroSectionClient } from "./hero-section-client";

export async function HeroSection() {
	const content = await getMarketingHeroContent();

	return (
		<HeroSectionClient
			badgeText={content.badgeText}
			headline={content.headline}
			headlineAccent={content.headlineAccent}
			subheadline={content.subheadline}
			ctaText={content.ctaText}
			videoUrl={content.videoUrl}
			thumbnailSrc={content.thumbnailSrc}
		/>
	);
}
