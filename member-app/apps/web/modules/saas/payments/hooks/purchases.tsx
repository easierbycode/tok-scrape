import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

export const usePurchases = () => {
	const { data, isPending } = useQuery(
		orpc.payments.listPurchases.queryOptions(),
	);

	const purchases = data?.purchases ?? [];

	const { activePlan, hasSubscription, hasPurchase } =
		createPurchasesHelper(purchases);

	return { purchases, activePlan, hasSubscription, hasPurchase, isPending };
};

export const useUserPurchases = () => usePurchases();
