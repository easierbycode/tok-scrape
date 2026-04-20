import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const deleteTestimonial = adminProcedure
	.route({
		method: "DELETE",
		path: "/testimonials/delete",
		tags: ["Testimonials"],
		summary: "Delete a testimonial",
		description: "Delete a testimonial (admin only)",
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		await db.testimonial.delete({
			where: { id: input.id },
		});
		return { success: true };
	});
