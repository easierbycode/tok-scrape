import { db } from "@repo/database";
import { adminProcedure } from "../../../orpc/procedures";

export const listTestimonialsAdmin = adminProcedure
	.route({
		method: "POST",
		path: "/testimonials/admin",
		tags: ["Testimonials"],
		summary: "List all testimonials (admin)",
		description:
			"Get all testimonials including unpublished, ordered by display order",
	})
	.handler(async () => {
		return await db.testimonial.findMany({
			orderBy: { order: "asc" },
		});
	});
