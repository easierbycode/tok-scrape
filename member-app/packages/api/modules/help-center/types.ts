import { z } from "zod";

export const helpCategorySchema = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	description: z.string(),
	icon: z.string(),
	order: z.number(),
	published: z.boolean(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const helpArticleSchema = z.object({
	id: z.string(),
	slug: z.string(),
	title: z.string(),
	content: z.string(),
	excerpt: z.string().nullable(),
	categoryId: z.string(),
	audience: z.string(),
	subsection: z.string().nullable(),
	featured: z.boolean(),
	order: z.number(),
	published: z.boolean(),
	views: z.number(),
	helpful: z.number(),
	notHelpful: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const categoryWithArticlesSchema = helpCategorySchema.extend({
	articles: z.array(helpArticleSchema),
});

export const createCategorySchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(1),
	description: z.string().min(1),
	icon: z.string().min(1),
	order: z.number().default(0),
	published: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
	id: z.string(),
});

export const createArticleSchema = z.object({
	slug: z.string().min(1),
	title: z.string().min(1),
	content: z.string().min(1),
	excerpt: z.string().optional(),
	categoryId: z.string(),
	audience: z.string().default("both"),
	subsection: z.string().optional(),
	featured: z.boolean().default(false),
	order: z.number().default(0),
	published: z.boolean().default(true),
});

export const updateArticleSchema = createArticleSchema.partial().extend({
	id: z.string(),
});

export const searchArticlesSchema = z.object({
	query: z.string().min(1),
	limit: z.number().int().positive().max(50).default(20),
});

export const listFeaturedArticlesSchema = z.object({
	audience: z.string().default("both"),
	limit: z.number().int().positive().max(10).default(5),
});

export const listCategoriesSchema = z.object({
	audience: z.string().optional(),
});

export const recordFeedbackSchema = z.object({
	articleId: z.string(),
	helpful: z.boolean(),
});

export const reorderCategoriesSchema = z.object({
	categoryOrders: z.array(
		z.object({
			id: z.string(),
			order: z.number(),
		}),
	),
});

export const reorderArticlesSchema = z.object({
	articleOrders: z.array(
		z.object({
			id: z.string(),
			order: z.number(),
		}),
	),
});
