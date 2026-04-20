import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const markNotificationAsRead = protectedProcedure
	.input(z.object({ notificationId: z.string() }))
	.handler(async ({ input, context }) => {
		await db.notification.updateMany({
			where: {
				id: input.notificationId,
				userId: context.user.id, // Security: only update own notifications
			},
			data: { read: true },
		});
		return { success: true };
	});

export const markAllNotificationsAsRead = protectedProcedure.handler(
	async ({ context }) => {
		await db.notification.updateMany({
			where: {
				userId: context.user.id,
				read: false,
			},
			data: { read: true },
		});
		return { success: true };
	},
);

export const dismissNotification = protectedProcedure
	.route({
		method: "POST",
		path: "/users/notifications/dismiss",
		tags: ["User"],
		summary: "Dismiss notification",
	})
	.input(z.object({ notificationId: z.string() }))
	.handler(async ({ input, context }) => {
		await db.notification.updateMany({
			where: {
				id: input.notificationId,
				userId: context.user.id, // Security: only dismiss own notifications
			},
			data: { dismissedAt: new Date() },
		});
		return { success: true };
	});
