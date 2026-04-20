import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const updateTestimonial = adminProcedure
	.route({
		method: "PUT",
		path: "/testimonials/update",
		tags: ["Testimonials"],
		summary: "Update a testimonial",
		description: "Update an existing testimonial (admin only)",
	})
	.input(
		z.object({
			id: z.string(),
			name: z.string().min(1).optional(),
			role: z.string().min(1).optional(),
			avatar: z.string().min(1).optional(),
			rating: z.number().min(1).max(5).optional(),
			content: z.string().min(1).optional(),
			stats: z.string().min(1).optional(),
			order: z.number().optional(),
			published: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		return await db.testimonial.update({
			where: { id },
			data,
		});
	});
