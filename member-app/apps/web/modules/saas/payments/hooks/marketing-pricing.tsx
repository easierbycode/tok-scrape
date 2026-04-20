import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

export function useMarketingPricing() {
	const { data, isPending } = useQuery(orpc.marketing.pricing.queryOptions());

	const plans = data ?? [];

	// Build a lookup map: stripePriceId → { price, period } for display
	const planByPriceId = new Map(
		plans
			.filter((p) => !!p.stripePriceId)
			.map((p) => [p.stripePriceId as string, p] as const),
	);

	function getDisplayPrice(productId?: string | null): string | null {
		if (!productId) {
			return null;
		}
		const plan = planByPriceId.get(productId);
		if (!plan) {
			return null;
		}
		return plan.period ? `${plan.price} ${plan.period}`.trim() : plan.price;
	}

	return { plans, planByPriceId, getDisplayPrice, isPending };
}
