import { db } from "@repo/database";
import { publicProcedure } from "../../../orpc/procedures";

export const getMarketingContent = publicProcedure
	.route({
		method: "GET",
		path: "/marketing/content",
		tags: ["Marketing"],
		summary: "Get marketing content",
		description: "Get marketing content for the homepage",
	})
	.handler(async () => {
		try {
			const content = await db.marketingContent.findUnique({
				where: { id: "singleton" },
				omit: { updatedBy: true },
			});
			return content;
		} catch {
			return null;
		}
	});
