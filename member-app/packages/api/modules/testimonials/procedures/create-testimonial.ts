import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const createTestimonial = adminProcedure
	.route({
		method: "POST",
		path: "/testimonials/create",
		tags: ["Testimonials"],
		summary: "Create a new testimonial",
		description: "Create a new testimonial (admin only)",
	})
	.input(
		z.object({
			name: z.string().min(1),
			role: z.string().min(1),
			avatar: z.string().min(1),
			rating: z.number().min(1).max(5).default(5),
			content: z.string().min(1),
			stats: z.string().min(1),
			order: z.number().default(0),
			published: z.boolean().default(true),
		}),
	)
	.handler(async ({ input }) => {
		return await db.testimonial.create({
			data: input,
		});
	});
