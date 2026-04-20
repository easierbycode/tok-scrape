import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const dismiss = protectedProcedure
	.route({
		method: "POST",
		path: "/announcements/dismiss",
		tags: ["Community"],
		summary: "Dismiss a global announcement",
	})
	.input(
		z.object({
			announcementId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { announcementId } = input;
		const userId = context.user.id;

		// Check if view record exists
		const existing = await db.globalAnnouncementView.findFirst({
			where: {
				announcementId,
				userId,
			},
		});

		if (existing) {
			// Update existing record
			await db.globalAnnouncementView.update({
				where: { id: existing.id },
				data: {
					dismissed: true,
					dismissedAt: new Date(),
				},
			});
		} else {
			// Create new dismissed view record
			await db.globalAnnouncementView.create({
				data: {
					announcementId,
					userId,
					dismissed: true,
					dismissedAt: new Date(),
				},
			});
		}

		return { success: true };
	});
