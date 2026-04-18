import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const listAllFaqs = adminProcedure
	.route({
		method: "GET",
		path: "/marketing/faqs/all",
		tags: ["Marketing"],
		summary: "List all FAQs (admin)",
		description: "Get all FAQs including unpublished (admin only)",
	})
	.handler(async () => {
		try {
			return await db.marketingFaq.findMany({
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});

export const createFaq = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/faqs/create",
		tags: ["Marketing"],
		summary: "Create FAQ",
		description: "Create a new FAQ entry (admin only)",
	})
	.input(
		z.object({
			question: z.string().min(1),
			answer: z.string().min(1),
			order: z.number().default(0),
			published: z.boolean().default(true),
			flagged: z.boolean().default(false),
		}),
	)
	.handler(async ({ input }) => {
		return await db.marketingFaq.create({
			data: input,
		});
	});

export const updateFaq = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/faqs/update",
		tags: ["Marketing"],
		summary: "Update FAQ",
		description: "Update an existing FAQ entry (admin only)",
	})
	.input(
		z.object({
			id: z.string(),
			question: z.string().min(1).optional(),
			answer: z.string().min(1).optional(),
			order: z.number().optional(),
			published: z.boolean().optional(),
			flagged: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		return await db.marketingFaq.update({
			where: { id },
			data,
		});
	});

export const deleteFaq = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/faqs/delete",
		tags: ["Marketing"],
		summary: "Delete FAQ",
		description: "Delete an FAQ entry (admin only)",
	})
	.input(
		z.object({
			id: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		return await db.marketingFaq.delete({
			where: { id: input.id },
		});
	});

export const reorderFaqs = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/faqs/reorder",
		tags: ["Marketing"],
		summary: "Reorder FAQs",
		description: "Reorder FAQ entries (admin only)",
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
			input.updates.map((update) =>
				db.marketingFaq.update({
					where: { id: update.id },
					data: { order: update.order },
				}),
			),
		);
		return { success: true };
	});
