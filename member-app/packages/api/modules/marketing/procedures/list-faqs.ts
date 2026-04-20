import { db } from "@repo/database";
import { publicProcedure } from "../../../orpc/procedures";

export const listMarketingFaqs = publicProcedure
	.route({
		method: "GET",
		path: "/marketing/faqs",
		tags: ["Marketing"],
		summary: "List marketing FAQs",
		description: "Get all published marketing FAQs ordered by display order",
	})
	.handler(async () => {
		try {
			return await db.marketingFaq.findMany({
				where: { published: true },
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});
