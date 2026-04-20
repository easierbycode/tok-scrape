import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const markAnnouncementRead = protectedProcedure
	.route({
		method: "POST",
		path: "/community/announcements/mark-read",
		tags: ["Community"],
		summary: "Mark a community announcement as read for the current user",
	})
	.input(z.object({ announcementId: z.string() }))
	.handler(async ({ input, context }) => {
		await db.announcementView.upsert({
			where: {
				announcementId_userId: {
					announcementId: input.announcementId,
					userId: context.user.id,
				},
			},
			create: {
				announcementId: input.announcementId,
				userId: context.user.id,
			},
			update: {
				readAt: new Date(),
			},
		});
		return { success: true };
	});

export const markAllAnnouncementsRead = protectedProcedure
	.route({
		method: "POST",
		path: "/community/announcements/mark-all-read",
		tags: ["Community"],
		summary: "Mark all community announcements as read for the current user",
	})
	.input(z.void().optional())
	.handler(async ({ context }) => {
		const announcements = await db.announcement.findMany({
			where: {
				publishedAt: { lte: new Date() },
				OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
			},
			select: { id: true },
		});

		await Promise.all(
			announcements.map((a) =>
				db.announcementView.upsert({
					where: {
						announcementId_userId: {
							announcementId: a.id,
							userId: context.user.id,
						},
					},
					create: {
						announcementId: a.id,
						userId: context.user.id,
					},
					update: {
						readAt: new Date(),
					},
				}),
			),
		);

		return { success: true };
	});
