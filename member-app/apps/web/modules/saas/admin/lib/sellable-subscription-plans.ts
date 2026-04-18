import { config as appConfig } from "@repo/config";

export interface SellablePlanPrice {
	planId: keyof typeof appConfig.payments.plans;
	priceId: string;
}

/**
 * Paid subscription plans shown in admin (excludes free, hidden, tests, lifetime).
 */
export function getSellableSubscriptionPlanPrices(): SellablePlanPrice[] {
	const plans = appConfig.payments.plans as typeof appConfig.payments.plans;
	const out: SellablePlanPrice[] = [];

	for (const planId of Object.keys(plans) as Array<keyof typeof plans>) {
		const plan = plans[planId];
		if (!plan || typeof plan !== "object") {
			continue;
		}
		if ("hidden" in plan && plan.hidden) {
			continue;
		}
		if ("isFree" in plan && plan.isFree) {
			continue;
		}
		if (planId === "manual_override" || planId === "no_active_plan") {
			continue;
		}

		const idStr = planId as string;
		if (idStr.startsWith("test_") || idStr === "lifetime") {
			continue;
		}

		if (!("prices" in plan) || !plan.prices?.length) {
			continue;
		}

		for (const price of plan.prices) {
			if (
				price.type === "recurring" &&
				"productId" in price &&
				typeof price.productId === "string" &&
				price.productId.length > 0
			) {
				out.push({ planId, priceId: price.productId });
			}
		}
	}

	return out;
}

export function formatPlanIdForAdminLabel(planId: string): string {
	return planId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
