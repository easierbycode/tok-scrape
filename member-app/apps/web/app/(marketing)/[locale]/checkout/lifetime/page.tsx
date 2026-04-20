import { getCachedPricingPlans } from "@marketing/lib/marketing-content-cache";
import { LifetimeCheckoutClient } from "./lifetime-checkout-client";

export default async function LifetimeCheckoutPage() {
	const plans = await getCachedPricingPlans();
	const row = plans.find((p) => p.planType === "lifetime") ?? null;

	return (
		<LifetimeCheckoutClient
			plan={
				row
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
					: null
			}
		/>
	);
}
