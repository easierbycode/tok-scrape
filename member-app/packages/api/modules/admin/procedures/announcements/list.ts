import { db } from "@repo/database";
import type { Prisma } from "@repo/database/prisma/generated/client";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const list = adminProcedure
	.route({
		method: "GET",
		path: "/admin/announcements/list",
		tags: ["Administration"],
		summary: "Get announcements list with filtering",
	})
	.input(
		z
			.object({
				searchTerm: z.string().optional(),
				status: z.enum(["all", "published", "draft"]).optional(),
				type: z
					.enum([
						"all",
						"welcome",
						"feature",
						"event",
						"maintenance",
						"community",
					])
					.optional(),
				priority: z
					.enum(["all", "normal", "important", "urgent"])
					.optional(),
			})
			.optional(),
	)
	.handler(async ({ input }) => {
		const filterInput = input || {};

		// Build where clause
		const where: Prisma.AnnouncementWhereInput = {};

		// Search filter
		if (filterInput.searchTerm) {
			const query = filterInput.searchTerm;
			where.OR = [
				{ title: { contains: query, mode: "insensitive" } },
				{ content: { contains: query, mode: "insensitive" } },
			];
		}

		// Status filter
		if (filterInput.status === "published") {
			where.publishedAt = { lte: new Date() };
		} else if (filterInput.status === "draft") {
			where.publishedAt = null;
		}

		// Type filter
		if (filterInput.type && filterInput.type !== "all") {
			where.type = filterInput.type;
		}

		// Priority filter
		if (filterInput.priority && filterInput.priority !== "all") {
			where.priority = filterInput.priority;
		}

		// Get announcements and stats
		const [announcements, totalCount, publishedCount, draftCount] =
			await Promise.all([
				db.announcement.findMany({
					where,
					orderBy: { createdAt: "desc" },
				}),
				db.announcement.count(),
				db.announcement.count({
					where: { publishedAt: { lte: new Date() } },
				}),
				db.announcement.count({
					where: { publishedAt: null },
				}),
			]);

		// Transform to match frontend expectations
		const transformedAnnouncements = announcements.map((a) => ({
			id: a.id,
			title: a.title,
			contentPreview: a.content.substring(0, 300),
			fullContent: a.content,
			type: a.type,
			priority: a.priority,
			author: "Admin", // Not stored in schema, using default
			published: a.publishedAt !== null && a.publishedAt <= new Date(),
			views: 0, // Not tracked yet
			createdAt: a.createdAt.toISOString(),
			updatedAt: a.updatedAt.toISOString(),
		}));

		// Calculate total views (sum of all views from announcements)
		const totalViews = transformedAnnouncements.reduce(
			(sum, a) => sum + a.views,
			0,
		);

		return {
			stats: {
				total: totalCount,
				published: publishedCount,
				draft: draftCount, // Singular, not "drafts"
				totalViews, // Required by frontend
			},
			announcements: transformedAnnouncements,
		};
	});
