import {
	getPurchasesByUserId,
} from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const listPurchases = protectedProcedure
	.route({
		method: "GET",
		path: "/payments/purchases",
		tags: ["Payments"],
		summary: "Get purchases",
		description: "Get all purchases of the current user",
	})
	.handler(async ({ context: { user } }) => {
		const purchases = await getPurchasesByUserId(user.id);
		return { purchases };
	});
