import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";
import {
	createArticleSchema,
	createCategorySchema,
	reorderArticlesSchema,
	reorderCategoriesSchema,
	updateArticleSchema,
	updateCategorySchema,
} from "../types";

export const listAllCategories = adminProcedure
	.route({
		method: "GET",
		path: "/admin/help-center/categories",
		tags: ["Admin", "Help Center"],
		summary: "List all help center categories (admin)",
	})
	.handler(async () => {
		const categories = await db.helpCategory.findMany({
			orderBy: {
				order: "asc",
			},
			include: {
				articles: {
					select: {
						id: true,
					},
				},
			},
		});

		return {
			categories: categories.map((category) => ({
				...category,
				articleCount: category.articles.length,
				articles: undefined,
			})),
		};
	});

export const createCategory = adminProcedure
	.route({
		method: "POST",
		path: "/admin/help-center/categories",
		tags: ["Admin", "Help Center"],
		summary: "Create a new help center category",
	})
	.input(createCategorySchema)
	.handler(async ({ input }) => {
		// Check if slug already exists
		const existing = await db.helpCategory.findUnique({
			where: { slug: input.slug },
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "Category with this slug already exists",
			});
		}

		const category = await db.helpCategory.create({
			data: input,
		});

		return category;
	});

export const updateCategory = adminProcedure
	.route({
		method: "PUT",
		path: "/admin/help-center/categories/:id",
		tags: ["Admin", "Help Center"],
		summary: "Update a help center category",
	})
	.input(updateCategorySchema)
	.handler(async ({ input }) => {
		const { id, ...data } = input;

		// Check if category exists
		const existing = await db.helpCategory.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		// If slug is being updated, check for conflicts
		if (data.slug && data.slug !== existing.slug) {
			const slugExists = await db.helpCategory.findUnique({
				where: { slug: data.slug },
			});

			if (slugExists) {
				throw new ORPCError("CONFLICT", {
					message: "Category with this slug already exists",
				});
			}
		}

		const category = await db.helpCategory.update({
			where: { id },
			data,
		});

		return category;
	});

export const deleteCategory = adminProcedure
	.route({
		method: "DELETE",
		path: "/admin/help-center/categories/:id",
		tags: ["Admin", "Help Center"],
		summary: "Delete a help center category",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const category = await db.helpCategory.findUnique({
			where: { id: input.id },
			include: {
				articles: true,
			},
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		// Check if category has articles
		if (category.articles.length > 0) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Cannot delete category with articles. Delete or move articles first.",
			});
		}

		await db.helpCategory.delete({
			where: { id: input.id },
		});

		return { success: true };
	});

export const listAllArticles = adminProcedure
	.route({
		method: "GET",
		path: "/admin/help-center/articles",
		tags: ["Admin", "Help Center"],
		summary: "List all help center articles (admin)",
	})
	.input(
		z
			.object({
				categoryId: z.string().optional(),
				published: z.boolean().optional(),
			})
			.optional(),
	)
	.handler(async ({ input }) => {
		const where: any = {};

		if (input?.categoryId) {
			where.categoryId = input.categoryId;
		}

		if (input?.published !== undefined) {
			where.published = input.published;
		}

		const articles = await db.helpArticle.findMany({
			where,
			include: {
				category: {
					select: {
						id: true,
						slug: true,
						title: true,
					},
				},
			},
			orderBy: [
				{
					categoryId: "asc",
				},
				{
					order: "asc",
				},
			],
		});

		return { articles };
	});

export const createArticle = adminProcedure
	.route({
		method: "POST",
		path: "/admin/help-center/articles",
		tags: ["Admin", "Help Center"],
		summary: "Create a new help center article",
	})
	.input(createArticleSchema)
	.handler(async ({ input }) => {
		// Check if slug already exists
		const existing = await db.helpArticle.findUnique({
			where: { slug: input.slug },
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "Article with this slug already exists",
			});
		}

		// Verify category exists
		const category = await db.helpCategory.findUnique({
			where: { id: input.categoryId },
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		const article = await db.helpArticle.create({
			data: input,
			include: {
				category: {
					select: {
						id: true,
						slug: true,
						title: true,
					},
				},
			},
		});

		return article;
	});

export const updateArticle = adminProcedure
	.route({
		method: "PUT",
		path: "/admin/help-center/articles/:id",
		tags: ["Admin", "Help Center"],
		summary: "Update a help center article",
	})
	.input(updateArticleSchema)
	.handler(async ({ input }) => {
		const { id, ...data } = input;

		// Check if article exists
		const existing = await db.helpArticle.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Article not found",
			});
		}

		// If slug is being updated, check for conflicts
		if (data.slug && data.slug !== existing.slug) {
			const slugExists = await db.helpArticle.findUnique({
				where: { slug: data.slug },
			});

			if (slugExists) {
				throw new ORPCError("CONFLICT", {
					message: "Article with this slug already exists",
				});
			}
		}

		// If categoryId is being updated, verify category exists
		if (data.categoryId && data.categoryId !== existing.categoryId) {
			const category = await db.helpCategory.findUnique({
				where: { id: data.categoryId },
			});

			if (!category) {
				throw new ORPCError("NOT_FOUND", {
					message: "Category not found",
				});
			}
		}

		const article = await db.helpArticle.update({
			where: { id },
			data,
			include: {
				category: {
					select: {
						id: true,
						slug: true,
						title: true,
					},
				},
			},
		});

		return article;
	});

export const deleteArticle = adminProcedure
	.route({
		method: "DELETE",
		path: "/admin/help-center/articles/:id",
		tags: ["Admin", "Help Center"],
		summary: "Delete a help center article",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input }) => {
		const article = await db.helpArticle.findUnique({
			where: { id: input.id },
		});

		if (!article) {
			throw new ORPCError("NOT_FOUND", {
				message: "Article not found",
			});
		}

		await db.helpArticle.delete({
			where: { id: input.id },
		});

		return { success: true };
	});

export const reorderCategories = adminProcedure
	.route({
		method: "POST",
		path: "/admin/help-center/categories/reorder",
		tags: ["Admin", "Help Center"],
		summary: "Reorder help center categories",
	})
	.input(reorderCategoriesSchema)
	.handler(async ({ input }) => {
		// Update all categories in a transaction
		await db.$transaction(
			input.categoryOrders.map(({ id, order }) =>
				db.helpCategory.update({
					where: { id },
					data: { order },
				}),
			),
		);

		return { success: true };
	});

export const reorderArticles = adminProcedure
	.route({
		method: "POST",
		path: "/admin/help-center/articles/reorder",
		tags: ["Admin", "Help Center"],
		summary: "Reorder help center articles",
	})
	.input(reorderArticlesSchema)
	.handler(async ({ input }) => {
		// Update all articles in a transaction
		await db.$transaction(
			input.articleOrders.map(({ id, order }) =>
				db.helpArticle.update({
					where: { id },
					data: { order },
				}),
			),
		);

		return { success: true };
	});
