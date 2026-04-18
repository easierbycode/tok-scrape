import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const reorderTestimonials = adminProcedure
	.route({
		method: "PUT",
		path: "/testimonials/reorder",
		tags: ["Testimonials"],
		summary: "Reorder testimonials",
		description: "Update the order of multiple testimonials (admin only)",
	})
	.input(
		z.object({
			updates: z.array(
				z.object({
					id: z.string(),
					order: z.number(),
				}),
			),
		}),
	)
	.handler(async ({ input }) => {
		await Promise.all(
			input.updates.map(({ id, order }) =>
				db.testimonial.update({
					where: { id },
					data: { order },
				}),
			),
		);
		return { success: true };
	});
