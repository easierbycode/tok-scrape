import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const upsert = adminProcedure
	.route({
		method: "POST",
		path: "/admin/announcements/global",
		tags: ["Administration"],
		summary: "Create or update a global announcement",
	})
	.input(
		z.object({
			type: z.enum(["site-wide", "onboarding"]),
			id: z.string().nullable().optional(),
			enabled: z.boolean(),
			title: z.string().min(1).max(200),
			content: z.string().min(1),
			priority: z.enum(["normal", "important", "urgent"]).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { type, enabled, title, content, priority } = input;

		// Check if announcement with this type already exists
		const existing = await db.globalAnnouncement.findFirst({
			where: { type },
		});

		let announcement;

		if (existing) {
			// Update existing
			announcement = await db.globalAnnouncement.update({
				where: { id: existing.id },
				data: {
					enabled,
					title,
					content,
					priority: priority || "normal",
					lastEditBy: context.user.id,
				},
			});

		const contentChanged =
			existing.content !== content || existing.title !== title;
		const wasReEnabled = !existing.enabled && enabled;

		// Only reset dismissals for site-wide announcements when content changes or
		// the announcement is re-enabled. Onboarding is a one-time-per-user event —
		// editing the message must not re-show it to users who already dismissed it.
		if (type === "site-wide" && (contentChanged || wasReEnabled)) {
			await db.globalAnnouncementView.deleteMany({
				where: {
					announcementId: existing.id,
					dismissed: true,
				},
			});
		}

			await logAdminAction({
				adminUserId: context.user.id,
				action: "UPDATE_GLOBAL_ANNOUNCEMENT",
				targetType: "global_announcement",
				targetId: announcement.id,
				summary: `Updated global announcement (${type}): "${title}"`,
				metadata: {
					type,
					enabled,
					title,
					contentChanged,
					wasReEnabled,
				},
			});
		} else {
			// Create new
			announcement = await db.globalAnnouncement.create({
				data: {
					type,
					enabled,
					title,
					content,
					priority: priority || "normal",
					createdBy: context.user.id,
				},
			});

			await logAdminAction({
				adminUserId: context.user.id,
				action: "CREATE_GLOBAL_ANNOUNCEMENT",
				targetType: "global_announcement",
				targetId: announcement.id,
				summary: `Created global announcement (${type}): "${title}"`,
				metadata: {
					type,
					title,
				},
			});
		}

		return {
			success: true,
			id: announcement.id,
			announcement,
		};
	});
