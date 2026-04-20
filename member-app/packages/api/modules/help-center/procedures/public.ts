import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";
import {
	listCategoriesSchema,
	listFeaturedArticlesSchema,
	recordFeedbackSchema,
	searchArticlesSchema,
} from "../types";

export const listCategories = publicProcedure
	.route({
		method: "GET",
		path: "/help-center/categories",
		tags: ["Help Center"],
		summary: "List all published help center categories",
	})
	.input(listCategoriesSchema)
	.handler(async ({ input }) => {
		const articleWhere: Record<string, unknown> = { published: true };

		if (input.audience)
			articleWhere.audience = { in: [input.audience, "both"] };

		const categories = await db.helpCategory.findMany({
			where: {
				published: true,
				...(input.audience
					? { articles: { some: articleWhere } }
					: {}),
			},
			orderBy: {
				order: "asc",
			},
			include: {
				articles: {
					where: articleWhere,
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

export const getCategory = publicProcedure
	.route({
		method: "GET",
		path: "/help-center/categories/:slug",
		tags: ["Help Center"],
		summary: "Get a category with its articles",
	})
	.input(
		z.object({
			slug: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const category = await db.helpCategory.findUnique({
			where: {
				slug: input.slug,
				published: true,
			},
			include: {
				articles: {
					where: {
						published: true,
					},
					orderBy: {
						order: "asc",
					},
				},
			},
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		return { category };
	});

const BOT_UA_PATTERN =
	/bot|crawler|spider|ahrefsbot|semrush|serpstat|seranking|mj12bot|dotbot|petalbot|googlebot|bingbot|yandex|baidu|duckduckbot|facebookexternalhit|linkedinbot|twitterbot|slackbot|whatsapp/i;

export const getArticle = publicProcedure
	.route({
		method: "GET",
		path: "/help-center/articles/:categorySlug/:slug",
		tags: ["Help Center"],
		summary: "Get a single article and increment view count",
	})
	.input(
		z.object({
			categorySlug: z.string(),
			slug: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		// First find the category
		const category = await db.helpCategory.findUnique({
			where: {
				slug: input.categorySlug,
				published: true,
			},
		});

		if (!category) {
			throw new ORPCError("NOT_FOUND", {
				message: "Category not found",
			});
		}

		// Find the article
		const article = await db.helpArticle.findUnique({
			where: {
				slug: input.slug,
				categoryId: category.id,
				published: true,
			},
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

		if (!article) {
			throw new ORPCError("NOT_FOUND", {
				message: "Article not found",
			});
		}

		// Layer 1: skip view counting entirely for known crawlers — bots
		// hitting the help center are the primary source of lock contention.
		const userAgent = context.headers.get("user-agent") ?? "";
		const isBot = BOT_UA_PATTERN.test(userAgent);

		if (!isBot) {
			// Layer 2: use a raw UPDATE with no RETURNING clause. The ORM
			// default returns all 16 columns which adds unnecessary data
			// transfer and slightly more work for Postgres on every view hit.
			// The query_timeout on the pool (Layer 3) hard-caps this at 8s
			// if Postgres ever has lock contention again.
			db.$executeRaw`UPDATE "help_article" SET "views" = "views" + 1 WHERE "id" = ${article.id}`.catch(
				() => {},
			);
		}

		return { article };
	});

export const searchArticles = publicProcedure
	.route({
		method: "GET",
		path: "/help-center/search",
		tags: ["Help Center"],
		summary: "Search help center articles",
	})
	.input(searchArticlesSchema)
	.handler(async ({ input }) => {
		const { query, limit } = input;

		// Simple text search - can be enhanced with full-text search later
		const articles = await db.helpArticle.findMany({
			where: {
				published: true,
				OR: [
					{
						title: {
							contains: query,
							mode: "insensitive",
						},
					},
					{
						content: {
							contains: query,
							mode: "insensitive",
						},
					},
					{
						excerpt: {
							contains: query,
							mode: "insensitive",
						},
					},
				],
			},
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
					featured: "desc",
				},
				{
					views: "desc",
				},
			],
			take: limit,
		});

		return { articles };
	});

export const listFeaturedArticles = publicProcedure
	.route({
		method: "GET",
		path: "/help-center/featured",
		tags: ["Help Center"],
		summary: "List featured articles filtered by audience",
	})
	.input(listFeaturedArticlesSchema)
	.handler(async ({ input }) => {
		const { audience, limit } = input;

		const articles = await db.helpArticle.findMany({
			where: {
				published: true,
				featured: true,
				audience: { in: [audience, "both"] },
			},
			include: {
				category: {
					select: {
						id: true,
						slug: true,
						title: true,
					},
				},
			},
			orderBy: { order: "asc" },
			take: limit,
		});

		return { articles };
	});

export const recordFeedback = publicProcedure
	.route({
		method: "POST",
		path: "/help-center/articles/feedback",
		tags: ["Help Center"],
		summary: "Record helpful/not helpful feedback for an article",
	})
	.input(recordFeedbackSchema)
	.handler(async ({ input }) => {
		const { articleId, helpful } = input;

		const article = await db.helpArticle.findUnique({
			where: {
				id: articleId,
				published: true,
			},
		});

		if (!article) {
			throw new ORPCError("NOT_FOUND", {
				message: "Article not found",
			});
		}

		// Update feedback count
		await db.helpArticle.update({
			where: { id: articleId },
			data: helpful
				? { helpful: { increment: 1 } }
				: { notHelpful: { increment: 1 } },
		});

		return { success: true };
	});
