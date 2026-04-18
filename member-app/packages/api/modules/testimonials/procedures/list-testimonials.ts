import { db } from "@repo/database";
import { publicProcedure } from "../../../orpc/procedures";

export const listTestimonials = publicProcedure
	.route({
		method: "GET",
		path: "/testimonials",
		tags: ["Testimonials"],
		summary: "List published testimonials",
		description: "Get all published testimonials ordered by display order",
	})
	.handler(async () => {
		return await db.testimonial.findMany({
			where: { published: true },
			orderBy: { order: "asc" },
		});
	});
