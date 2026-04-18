import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const updateNotificationEmail = protectedProcedure
	.route({
		method: "POST",
		path: "/users/notification-email",
		tags: ["Users"],
		summary: "Update the notification email for the current user",
	})
	.input(
		z.object({
			notificationEmail: z.string().email().or(z.literal("")),
		}),
	)
	.handler(async ({ input, context }) => {
		const { notificationEmail } = input;

		await db.user.update({
			where: { id: context.user.id },
			data: {
				notificationEmail: notificationEmail || null,
			},
		});

		return { success: true };
	});
