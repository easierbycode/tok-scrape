import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure, publicProcedure } from "../../../orpc/procedures";

export const listPublishedBenefits = publicProcedure
	.route({
		method: "GET",
		path: "/marketing/benefits",
		tags: ["Marketing"],
		summary: "List published benefits",
	})
	.handler(async () => {
		try {
			return await db.marketingBenefit.findMany({
				where: { published: true },
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});

export const listAllBenefits = adminProcedure
	.route({
		method: "GET",
		path: "/marketing/benefits/all",
		tags: ["Marketing"],
		summary: "List all benefits (admin)",
	})
	.handler(async () => {
		try {
			return await db.marketingBenefit.findMany({
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});

export const createBenefit = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/benefits/create",
		tags: ["Marketing"],
		summary: "Create a benefit",
	})
	.input(
		z.object({
			icon: z.string(),
			heading: z.string().min(1),
			bullets: z.array(z.string()),
			order: z.number().optional(),
			published: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		return await db.marketingBenefit.create({ data: input });
	});

export const updateBenefit = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/benefits/update",
		tags: ["Marketing"],
		summary: "Update a benefit",
	})
	.input(
		z.object({
			id: z.string(),
			icon: z.string().optional(),
			heading: z.string().optional(),
			bullets: z.array(z.string()).optional(),
			order: z.number().optional(),
			published: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		return await db.marketingBenefit.update({ where: { id }, data });
	});

export const deleteBenefit = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/benefits/delete",
		tags: ["Marketing"],
		summary: "Delete a benefit",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		return await db.marketingBenefit.delete({ where: { id: input.id } });
	});

export const reorderBenefits = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/benefits/reorder",
		tags: ["Marketing"],
		summary: "Reorder benefits",
	})
	.input(
		z.object({
			updates: z.array(z.object({ id: z.string(), order: z.number() })),
		}),
	)
	.handler(async ({ input }) => {
		await Promise.all(
			input.updates.map((u) =>
				db.marketingBenefit.update({
					where: { id: u.id },
					data: { order: u.order },
				}),
			),
		);
		return { success: true };
	});
