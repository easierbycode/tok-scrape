import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure, publicProcedure } from "../../../orpc/procedures";

export const listPublishedPricingPlans = publicProcedure
	.route({
		method: "GET",
		path: "/marketing/pricing",
		tags: ["Marketing"],
		summary: "List published pricing plans",
	})
	.handler(async () => {
		try {
			return await db.marketingPricingPlan.findMany({
				where: { published: true },
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});

export const listAllPricingPlans = adminProcedure
	.route({
		method: "GET",
		path: "/marketing/pricing/all",
		tags: ["Marketing"],
		summary: "List all pricing plans (admin)",
	})
	.handler(async () => {
		try {
			return await db.marketingPricingPlan.findMany({
				orderBy: { order: "asc" },
			});
		} catch {
			return [];
		}
	});

export const getActivePromo = publicProcedure
	.route({
		method: "GET",
		path: "/marketing/pricing/promo",
		tags: ["Marketing"],
		summary: "Get active promotional plan",
	})
	.handler(async () => {
		try {
			const promo = await db.marketingPricingPlan.findFirst({
				where: { planType: "promo", published: true },
				orderBy: { updatedAt: "desc" },
			});
			return promo;
		} catch {
			return null;
		}
	});

export const createPricingPlan = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/pricing/create",
		tags: ["Marketing"],
		summary: "Create a pricing plan",
	})
	.input(
		z.object({
			name: z.string().min(1),
			price: z.string().min(1),
			period: z.string().min(1),
			subtitle: z.string().nullable().optional(),
			description: z.string().min(1),
			features: z.array(z.string()),
			ctaText: z.string().optional(),
			checkoutUrl: z.string().min(1),
			stripePriceId: z.string().nullable().optional(),
			planType: z.enum(["standard", "promo", "lifetime"]).optional(),
			popular: z.boolean().optional(),
			badge: z.string().nullable().optional(),
			icon: z.string().nullable().optional(),
			discordRoleEnvKey: z.string().nullable().optional(),
			allowPromoCodes: z.boolean().optional(),
			inheritsFrom: z.string().nullable().optional(),
			compareAtPrice: z.string().nullable().optional(),
			trustText: z.string().nullable().optional(),
			order: z.number().optional(),
			published: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		return await db.marketingPricingPlan.create({ data: input });
	});

export const updatePricingPlan = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/pricing/update",
		tags: ["Marketing"],
		summary: "Update a pricing plan",
	})
	.input(
		z.object({
			id: z.string(),
			name: z.string().optional(),
			price: z.string().optional(),
			period: z.string().optional(),
			subtitle: z.string().nullable().optional(),
			description: z.string().optional(),
			features: z.array(z.string()).optional(),
			ctaText: z.string().optional(),
			checkoutUrl: z.string().optional(),
			stripePriceId: z.string().nullable().optional(),
			planType: z.enum(["standard", "promo", "lifetime"]).optional(),
			popular: z.boolean().optional(),
			badge: z.string().nullable().optional(),
			icon: z.string().nullable().optional(),
			discordRoleEnvKey: z.string().nullable().optional(),
			allowPromoCodes: z.boolean().optional(),
			inheritsFrom: z.string().nullable().optional(),
			compareAtPrice: z.string().nullable().optional(),
			trustText: z.string().nullable().optional(),
			order: z.number().optional(),
			published: z.boolean().optional(),
		}),
	)
	.handler(async ({ input }) => {
		const { id, ...data } = input;
		return await db.marketingPricingPlan.update({ where: { id }, data });
	});

export const deletePricingPlan = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/pricing/delete",
		tags: ["Marketing"],
		summary: "Delete a pricing plan",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		return await db.marketingPricingPlan.delete({
			where: { id: input.id },
		});
	});

export const reorderPricingPlans = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/pricing/reorder",
		tags: ["Marketing"],
		summary: "Reorder pricing plans",
	})
	.input(
		z.object({
			updates: z.array(z.object({ id: z.string(), order: z.number() })),
		}),
	)
	.handler(async ({ input }) => {
		await Promise.all(
			input.updates.map((u) =>
				db.marketingPricingPlan.update({
					where: { id: u.id },
					data: { order: u.order },
				}),
			),
		);
		return { success: true };
	});
