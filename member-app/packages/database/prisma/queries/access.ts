import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db } from "../client";
import type { Purchase } from "../generated/client";

/**
 * Check if user has active access (subscription, manual override, or lifetime purchase)
 */
export async function userHasAccess(userId: string): Promise<boolean> {
	const purchase = await db.purchase.findFirst({
		where: {
			userId,
			OR: [
				{
					type: "SUBSCRIPTION",
					status: { in: ["active", "trialing", "grace_period"] },
				},
			{
				type: "ONE_TIME",
				productId: MANUAL_OVERRIDE_PRODUCT_ID,
				status: { notIn: ["cancelled", "canceled"] },
			},
				{
					type: "ONE_TIME",
					NOT: { productId: MANUAL_OVERRIDE_PRODUCT_ID },
				},
			],
		},
	});
	return !!purchase;
}

/**
 * Get user's manual override purchase (if exists)
 */
export async function getManualOverride(
	userId: string,
): Promise<Purchase | null> {
	return await db.purchase.findFirst({
		where: {
			userId,
			type: "ONE_TIME",
			productId: MANUAL_OVERRIDE_PRODUCT_ID,
			status: { notIn: ["cancelled", "canceled"] },
		},
	});
}

/**
 * Get user's active subscription purchase
 */
export async function getActiveSubscription(
	userId: string,
): Promise<Purchase | null> {
	return await db.purchase.findFirst({
		where: {
			userId,
			type: "SUBSCRIPTION",
			status: { in: ["active", "trialing", "grace_period"] },
		},
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Get user's lifetime (non-manual-override one-time) purchase, if exists
 */
export async function getLifetimePurchase(
	userId: string,
): Promise<Purchase | null> {
	return await db.purchase.findFirst({
		where: {
			userId,
			type: "ONE_TIME",
			NOT: { productId: MANUAL_OVERRIDE_PRODUCT_ID },
		},
		orderBy: { createdAt: "desc" },
	});
}
