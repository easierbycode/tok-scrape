import { db } from "@repo/database";
import type { Prisma } from "@repo/database/prisma/generated/client";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const listNotifications = adminProcedure
	.route({
		method: "GET",
		path: "/admin/notifications",
		tags: ["Administration"],
		summary: "List admin notifications",
	})
	.input(
		z
			.object({
				search: z.string().optional(),
				type: z.string().optional().default("all"),
				readStatus: z
					.enum(["all", "unread", "read"])
					.optional()
					.default("all"),
				dismissed: z.boolean().optional().default(false),
				limit: z.number().int().positive().optional().default(50),
				offset: z.number().int().nonnegative().optional().default(0),
			})
			.optional(),
	)
	.handler(async ({ input, context }) => {
		// Build where clause
		const where: Prisma.NotificationWhereInput = {
			userId: context.user.id, // Filter by current admin user
		};

		// Search filter
		if (input?.search) {
			where.OR = [
				{ title: { contains: input.search, mode: "insensitive" } },
				{ message: { contains: input.search, mode: "insensitive" } },
			];
		}

		// Type filter
		if (input?.type && input.type !== "all") {
			where.type = input.type;
		}

		// Read status filter
		if (input?.readStatus === "unread") {
			where.read = false;
		} else if (input?.readStatus === "read") {
			where.read = true;
		}

		// Dismissed filter
		if (input?.dismissed === false) {
			where.dismissedAt = null;
		} else if (input?.dismissed === true) {
			where.dismissedAt = { not: null };
		}

		// Get notifications with pagination
		const [notifications, total] = await Promise.all([
			db.notification.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: input?.offset ?? 0,
				take: input?.limit ?? 50,
				include: {
					user: {
						select: {
							id: true,
							name: true,
							email: true,
						},
					},
				},
			}),
			db.notification.count({ where }),
		]);

		// Get stats (filtered by current admin user)
		const [totalCount, unreadCount, readCount, dismissedCount] =
			await Promise.all([
				db.notification.count({ where: { userId: context.user.id } }),
				db.notification.count({
					where: { userId: context.user.id, read: false },
				}),
				db.notification.count({
					where: { userId: context.user.id, read: true },
				}),
				db.notification.count({
					where: {
						userId: context.user.id,
						dismissedAt: { not: null },
					},
				}),
			]);

		// Transform to match frontend expectations
		const transformedNotifications = notifications.map((n) => ({
			id: n.id,
			type: n.type as any, // Map to NotificationType
			title: n.title,
			message: n.message,
			metadata: {}, // Not stored in schema, return empty object
			link: undefined, // Not stored in schema
			read: n.read,
			dismissed: n.dismissedAt !== null,
			createdAt: n.createdAt.toISOString(),
			user: n.user,
		}));

		return {
			notifications: transformedNotifications,
			stats: {
				total: totalCount,
				unread: unreadCount,
				read: readCount,
				dismissed: dismissedCount,
			},
			total,
			hasMore: (input?.offset ?? 0) + (input?.limit ?? 50) < total,
		};
	});
