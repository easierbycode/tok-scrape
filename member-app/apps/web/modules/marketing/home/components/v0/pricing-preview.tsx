import {
	getCachedMarketingContent,
	getCachedPricingPlans,
} from "@marketing/lib/marketing-content-cache";
import { PricingCards } from "./pricing-cards";

export async function PricingPreview() {
	const [dbPlans, contentRow] = await Promise.all([
		getCachedPricingPlans(),
		getCachedMarketingContent(),
	]);

	const content = {
		pricingBadgeText: contentRow?.pricingBadgeText ?? "Simple Pricing",
		pricingHeadline: contentRow?.pricingHeadline ?? "Choose Your Plan",
		pricingSubheadline:
			contentRow?.pricingSubheadline ??
			"Get instant access to live training, the private community, and everything LifePreneur has to offer.",
	};

	if (dbPlans.length === 0) {
		return (
			<section id="pricing" className="pt-24 pb-12 md:pt-32 md:pb-20">
				<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
					<div className="mx-auto max-w-2xl text-center">
						<p className="mb-2 text-sm font-semibold text-primary">
							{content.pricingBadgeText}
						</p>
						<h2 className="mb-4 font-bold text-2xl text-foreground md:text-3xl">
							{content.pricingHeadline}
						</h2>
						<p className="text-base leading-relaxed text-muted-foreground">
							Pricing is temporarily unavailable. Please try again
							shortly.
						</p>
					</div>
				</div>
			</section>
		);
	}

	const plans = dbPlans.map((p) => ({
		name: p.name,
		price: p.price,
		period: p.period,
		subtitle: p.subtitle,
		description: p.description,
		features: p.features,
		ctaText: p.ctaText,
		popular: p.popular,
		badge: p.badge,
		checkoutUrl: p.checkoutUrl,
		icon: p.icon,
		inheritsFrom: p.inheritsFrom,
		compareAtPrice: p.compareAtPrice,
		trustText: p.trustText,
	}));

	return (
		<section id="pricing" className="pt-24 pb-12 md:pt-32 md:pb-20">
			<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
				<PricingCards
					plans={plans}
					badgeText={content.pricingBadgeText}
					headline={content.pricingHeadline}
					subheadline={content.pricingSubheadline}
				/>
			</div>
		</section>
	);
}
