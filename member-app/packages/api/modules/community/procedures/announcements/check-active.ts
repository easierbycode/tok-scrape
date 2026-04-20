import { db } from "@repo/database";
import { protectedProcedure } from "../../../../orpc/procedures";

export const checkActive = protectedProcedure
	.route({
		method: "GET",
		path: "/announcements/check-active",
		tags: ["Community"],
		summary: "Check for active global announcements",
	})
	.handler(async ({ context }) => {
		const userId = context.user.id;

		// Get the active site-wide announcement
		const announcement = await db.globalAnnouncement.findFirst({
			where: {
				type: "site-wide",
				enabled: true,
			},
		});

		if (!announcement) {
			return {
				hasAnnouncement: false,
				dismissed: false,
				announcement: null,
			};
		}

		// Check if user has dismissed this announcement
		const view = await db.globalAnnouncementView.findFirst({
			where: {
				announcementId: announcement.id,
				userId: userId,
			},
		});

		const dismissed = view?.dismissed || false;

		return {
			hasAnnouncement: true,
			dismissed,
			announcement: {
				id: announcement.id,
				title: announcement.title,
				content: announcement.content,
				priority: announcement.priority,
			},
		};
	});
