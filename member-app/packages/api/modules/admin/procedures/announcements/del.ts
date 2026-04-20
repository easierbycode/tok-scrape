import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const del = adminProcedure
	.route({
		method: "POST",
		path: "/admin/announcements/delete",
		tags: ["Administration"],
		summary: "Delete an announcement",
	})
	.input(
		z.object({
			id: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		// Check if announcement exists
		const existing = await db.announcement.findUnique({
			where: { id: input.id },
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Announcement not found",
			});
		}

		// Delete announcement
		await db.announcement.delete({
			where: { id: input.id },
		});

		// Log action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "DELETE_ANNOUNCEMENT",
			targetType: "announcement",
			targetId: input.id,
			summary: `Deleted announcement "${existing.title}"`,
			metadata: {
				title: existing.title,
				type: existing.type,
			},
		});

		return { success: true };
	});
