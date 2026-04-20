import { db } from "@repo/database";
import type { Prisma } from "@repo/database/prisma/generated/client";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const listUserNotifications = protectedProcedure
	.route({
		method: "GET",
		path: "/users/notifications",
		tags: ["Users"],
		summary: "List user notifications",
	})
	.input(
		z.object({
			readStatus: z
				.enum(["all", "unread", "read"])
				.optional()
				.default("all"),
			dismissed: z.boolean().optional().default(false),
			limit: z.number().int().positive().optional().default(20),
			offset: z.number().int().nonnegative().optional().default(0),
		}),
	)
	.handler(async ({ input, context }) => {
		const where: Prisma.NotificationWhereInput = {
			userId: context.user.id,
		};

		if (input.readStatus === "unread") {
			where.read = false;
		} else if (input.readStatus === "read") {
			where.read = true;
		}

		if (input.dismissed === false) {
			where.dismissedAt = null;
		} else if (input.dismissed === true) {
			where.dismissedAt = { not: null };
		}

		const [notifications, filteredTotal, unreadCount] = await Promise.all([
			db.notification.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: input.offset,
				take: input.limit,
			}),
			db.notification.count({ where }),
			db.notification.count({
				where: { userId: context.user.id, read: false },
			}),
		]);

		return {
			notifications: notifications.map((n) => ({
				id: n.id,
				type: n.type,
				title: n.title,
				message: n.message,
				read: n.read,
				dismissed: n.dismissedAt !== null,
				createdAt: n.createdAt.toISOString(),
			})),
			stats: {
				total: filteredTotal,
				unread: unreadCount,
			},
			total: filteredTotal,
			hasMore: input.offset + input.limit < filteredTotal,
		};
	});
