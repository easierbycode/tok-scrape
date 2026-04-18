import { db } from "@repo/database";

/**
 * Friendly plan label for emails — prefers published marketing pricing row name.
 */
export async function getMarketingPlanNameByStripePriceId(
	productId: string | null | undefined,
): Promise<string> {
	if (!productId) {
		return "Your plan";
	}
	const row = await db.marketingPricingPlan.findFirst({
		where: { stripePriceId: productId },
		select: { name: true },
	});
	return row?.name ?? "Your plan";
}
