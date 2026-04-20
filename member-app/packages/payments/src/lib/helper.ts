import { type Config, config } from "@repo/config";
import type { PurchaseSchema } from "@repo/database";
import type { z } from "zod";

const plans = config.payments.plans as Config["payments"]["plans"];

type PlanId = keyof typeof config.payments.plans;
type PurchaseWithoutTimestamps = Omit<
	z.infer<typeof PurchaseSchema>,
	"createdAt" | "updatedAt"
>;

function notifyUnmatchedStripePriceId(productId: string) {
	if (typeof window !== "undefined") return;
	void import("@repo/database")
		.then(({ notifyAllAdmins }) =>
			notifyAllAdmins({
				type: "billing_config_mismatch",
				title: "Unmatched Stripe price",
				message: `User has a purchase (productId: ${productId}) that doesn't match any configured plan. Check config/index.ts plan definitions.`,
			}),
		)
		.catch(() => undefined);
}

function getActivePlanFromPurchases(purchases?: PurchaseWithoutTimestamps[]) {
	// 1. Check for manual override FIRST (highest priority) — only if still active
	const manualOverride = purchases?.find(
		(purchase) =>
			purchase.productId === "manual-override" &&
			purchase.status !== "cancelled" &&
			purchase.status !== "canceled",
	);

	if (manualOverride) {
		return {
			id: "manual_override" as PlanId,
			status: "active" as const,
			purchaseId: manualOverride.id,
			isManualOverride: true,
		};
	}

	// 2. Check for active/grace_period/trialing subscriptions (CRITICAL FIX)
	const subscriptionPurchase = purchases?.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" &&
			(purchase.status === "active" ||
				purchase.status === "grace_period" ||
				purchase.status === "trialing"),
	);

	if (subscriptionPurchase) {
		const planEntry = Object.entries(plans).find(([_, plan]) =>
			plan.prices?.some(
				(price) => price.productId === subscriptionPurchase.productId,
			),
		);

		if (!planEntry) {
			notifyUnmatchedStripePriceId(subscriptionPurchase.productId);
			return {
				id: "no_active_plan" as PlanId,
				price: undefined,
				status: subscriptionPurchase.status,
				purchaseId: subscriptionPurchase.id,
				isManualOverride: false,
			};
		}

		const [planId, matchedPlan] = planEntry;

		return {
			id: planId as PlanId,
			price: matchedPlan.prices?.find(
				(price) => price.productId === subscriptionPurchase.productId,
			),
			status: subscriptionPurchase.status,
			purchaseId: subscriptionPurchase.id,
			isManualOverride: false,
		};
	}

	// 3. Check for one-time purchases (lifetime — manual-override already handled in step 1)
	const oneTimePurchase = purchases?.find(
		(purchase) =>
			purchase.type === "ONE_TIME" &&
			purchase.productId !== "manual-override",
	);

	if (oneTimePurchase) {
		const planEntry = Object.entries(plans).find(([_, plan]) =>
			plan.prices?.some(
				(price) => price.productId === oneTimePurchase.productId,
			),
		);

		if (!planEntry) {
			notifyUnmatchedStripePriceId(oneTimePurchase.productId);
			return {
				id: "no_active_plan" as PlanId,
				price: undefined,
				status: "lifetime" as const,
				purchaseId: oneTimePurchase.id,
				isManualOverride: false,
			};
		}

		const [planId, matchedPlan] = planEntry;

		return {
			id: planId as PlanId,
			price: matchedPlan.prices?.find(
				(price) => price.productId === oneTimePurchase.productId,
			),
			status: "lifetime" as const,
			purchaseId: oneTimePurchase.id,
			isManualOverride: false,
		};
	}

	// 4. Fallback to free plan (unchanged)
	const freePlan = Object.entries(plans).find(([_, plan]) => plan.isFree);

	return freePlan
		? {
				id: freePlan[0] as PlanId,
				status: "active",
				isManualOverride: false,
			}
		: null;
}

/**
 * Resolves a config plan key (e.g. `starter_monthly`) to the primary recurring Stripe price id.
 * Prefers monthly interval when multiple recurring prices exist.
 */
export function resolveSubscriptionProductIdFromPlanKey(
	planKey: string,
): string | undefined {
	const plan = plans[planKey as PlanId];
	if (!plan || !("prices" in plan) || !plan.prices?.length) {
		return undefined;
	}
	const monthly = plan.prices.find(
		(p) =>
			p.type === "recurring" && "interval" in p && p.interval === "month",
	);
	const chosen = monthly ?? plan.prices[0];
	return chosen && "productId" in chosen ? chosen.productId : undefined;
}

export function createPurchasesHelper(purchases: PurchaseWithoutTimestamps[]) {
	const activePlan = getActivePlanFromPurchases(purchases);

	const hasSubscription = (planIds?: PlanId[] | PlanId) => {
		return (
			!!activePlan &&
			(Array.isArray(planIds)
				? planIds.includes(activePlan.id)
				: planIds === activePlan.id)
		);
	};

	const hasPurchase = (planId: PlanId) => {
		return !!purchases?.some((purchase) =>
			Object.entries(plans)
				.find(([id]) => id === planId)?.[1]
				.prices?.some(
					(price) => price.productId === purchase.productId,
				),
		);
	};

	return { activePlan, hasSubscription, hasPurchase };
}
