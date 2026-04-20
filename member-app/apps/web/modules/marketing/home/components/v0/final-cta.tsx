import { getCachedMarketingContent } from "@marketing/lib/marketing-content-cache";
import { FinalCtaContent } from "./final-cta-content";

const defaults = {
	badgeText: "Join the Community",
	headline: "Ready to Build Something Real?",
	description:
		"Stop figuring it out alone. Join a community of creators who are actively building businesses, sharing what works, and growing together.",
	buttonText: "Get Started Today",
};

export async function FinalCTA() {
	const content = await getCachedMarketingContent();

	const data = {
		badgeText: content?.ctaBadgeText || defaults.badgeText,
		headline: content?.ctaHeadline || defaults.headline,
		description: content?.ctaDescription || defaults.description,
		buttonText: content?.ctaButtonText || defaults.buttonText,
	};

	return (
		<section
			id="final-cta"
			className="relative overflow-hidden pt-20 pb-12 md:pt-28 md:pb-20"
		>
			{/* Background Effects */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl animate-pulse-subtle" />
			</div>

			<div className="relative z-10 mx-auto max-w-4xl px-4 text-center md:px-8 lg:px-16">
				<FinalCtaContent
					badgeText={data.badgeText}
					headline={data.headline}
					description={data.description}
					buttonText={data.buttonText}
				/>
			</div>
		</section>
	);
}
