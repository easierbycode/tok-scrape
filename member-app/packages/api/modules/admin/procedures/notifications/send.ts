import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const sendNotification = adminProcedure
	.route({
		method: "POST",
		path: "/admin/notifications/send",
		tags: ["Administration"],
		summary: "Send a notification to a user",
	})
	.input(
		z.object({
			userId: z.string().min(1),
			type: z.enum(["info", "success", "warning", "error"]),
			title: z.string().min(1).max(200),
			message: z.string().min(1).max(1000),
		}),
	)
	.handler(async ({ input, context }) => {
		// Verify user exists
		const user = await db.user.findUnique({
			where: { id: input.userId },
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		// Create notification
		const notification = await db.notification.create({
			data: {
				userId: input.userId,
				type: input.type,
				title: input.title,
				message: input.message,
			},
		});

		// Log action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CREATE_NOTIFICATION",
			targetType: "notification",
			targetId: notification.id,
			summary: `Sent ${input.type} notification "${input.title}" to ${user.email}`,
			metadata: {
				userId: input.userId,
				type: input.type,
				title: input.title,
			},
		});

		return { notification };
	});
