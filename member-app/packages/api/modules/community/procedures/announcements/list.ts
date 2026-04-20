import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const listAnnouncements = protectedProcedure
	.route({
		method: "GET",
		path: "/community/announcements/list",
		tags: ["Community"],
		summary: "List active announcements",
		description:
			"Returns all published announcements that haven't expired yet, with per-user read status",
	})
	.input(z.void().optional())
	.handler(async ({ context }) => {
		const announcements = await db.announcement.findMany({
			where: {
				publishedAt: { lte: new Date() },
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			orderBy: { publishedAt: "desc" },
			include: {
				views: {
					where: { userId: context.user.id },
					select: { readAt: true },
				},
			},
		});

		return {
			announcements: announcements.map((a) => ({
				...a,
				read: a.views.length > 0,
				views: undefined,
			})),
		};
	});
