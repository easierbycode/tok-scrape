import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const markNotificationRead = adminProcedure
	.route({
		method: "POST",
		path: "/admin/notifications/mark-read",
		tags: ["Administration"],
		summary: "Mark notification as read",
	})
	.input(
		z.object({
			notificationId: z.string().min(1),
		}),
	)
	.handler(async ({ input }) => {
		const notification = await db.notification.findUnique({
			where: { id: input.notificationId },
		});

		if (!notification) {
			throw new ORPCError("NOT_FOUND", {
				message: "Notification not found",
			});
		}

		await db.notification.update({
			where: { id: input.notificationId },
			data: {
				read: true,
				readAt: new Date(),
			},
		});

		return { success: true };
	});

export const markAllNotificationsRead = adminProcedure
	.route({
		method: "POST",
		path: "/admin/notifications/mark-all-read",
		tags: ["Administration"],
		summary: "Mark all notifications as read",
	})
	.input(z.object({}))
	.handler(async () => {
		await db.notification.updateMany({
			where: {
				read: false,
			},
			data: {
				read: true,
				readAt: new Date(),
			},
		});

		return { success: true };
	});

export const dismissNotification = adminProcedure
	.route({
		method: "POST",
		path: "/admin/notifications/dismiss",
		tags: ["Administration"],
		summary: "Dismiss a notification",
	})
	.input(
		z.object({
			notificationId: z.string().min(1),
		}),
	)
	.handler(async ({ input }) => {
		const notification = await db.notification.findUnique({
			where: { id: input.notificationId },
		});

		if (!notification) {
			throw new ORPCError("NOT_FOUND", {
				message: "Notification not found",
			});
		}

		await db.notification.update({
			where: { id: input.notificationId },
			data: {
				dismissedAt: new Date(),
			},
		});

		return { success: true };
	});
