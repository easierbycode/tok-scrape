import { getCachedPricingPlans } from "@marketing/lib/marketing-content-cache";
import { PromoCheckoutClient } from "./promo-checkout-client";

export default async function PromoCheckoutPage() {
	const plans = await getCachedPricingPlans();
	const row = plans.find((p) => p.planType === "promo") ?? null;

	return (
		<PromoCheckoutClient
			promo={
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
