import { orpcClient } from "@shared/lib/orpc-client";
import { cache } from "react";

export const getPurchases = cache(async () => {
	const { purchases } = await orpcClient.payments.listPurchases({});

	return purchases;
});
