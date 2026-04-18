import { getCachedPricingPlans } from "@marketing/lib/marketing-content-cache";
import { PlanCheckoutClient } from "./plan-checkout-client";

interface PlanCheckoutPageProps {
	params: Promise<{ locale: string; plan: string }>;
}

export default async function PlanCheckoutPage({
	params,
}: PlanCheckoutPageProps) {
	const { plan: planSlug } = await params;
	const checkoutPath = `/checkout/${planSlug}`;

	const plans = await getCachedPricingPlans();
	const row = plans.find((p) => p.checkoutUrl === checkoutPath) ?? null;

	const plan = row?.stripePriceId
		? {
				name: row.name,
				price: row.price,
				period: row.period,
				description: row.description,
				features: row.features,
				badge: row.badge,
				stripePriceId: row.stripePriceId,
				allowPromoCodes: row.allowPromoCodes,
			}
		: null;

	return <PlanCheckoutClient planSlug={planSlug} plan={plan} />;
}
