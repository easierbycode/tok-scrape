import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const update = adminProcedure
	.route({
		method: "POST",
		path: "/admin/announcements/update",
		tags: ["Administration"],
		summary: "Update an existing announcement",
	})
	.input(
		z.object({
			id: z.string().min(1),
			title: z.string().min(1).max(200).optional(),
			contentPreview: z.string().min(1).max(300).optional(),
			fullContent: z.string().min(1).optional(),
			type: z
				.enum([
					"welcome",
					"feature",
					"event",
					"maintenance",
					"community",
				])
				.optional(),
			priority: z.enum(["normal", "important", "urgent"]).optional(),
			author: z.string().optional(),
			published: z.boolean().optional(),
			expiresAt: z.string().datetime().optional().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { id, ...updateData } = input;

		// Check if announcement exists
		const existing = await db.announcement.findUnique({
			where: { id },
		});

		if (!existing) {
			throw new ORPCError("NOT_FOUND", {
				message: "Announcement not found",
			});
		}

		// Build update data
		const data: {
			title?: string;
			content?: string;
			type?: string;
			priority?: string;
			publishedAt?: Date | null;
			expiresAt?: Date | null;
		} = {};

		if (updateData.title !== undefined) {
			data.title = updateData.title;
		}
		if (updateData.fullContent !== undefined) {
			data.content = updateData.fullContent;
		}
		if (updateData.type !== undefined) {
			data.type = updateData.type;
		}
		if (updateData.priority !== undefined) {
			data.priority = updateData.priority;
		}
		if (updateData.published !== undefined) {
			data.publishedAt = updateData.published ? new Date() : null;
		}
		if (updateData.expiresAt !== undefined) {
			data.expiresAt = updateData.expiresAt
				? new Date(updateData.expiresAt)
				: null;
		}

		// Update announcement
		const announcement = await db.announcement.update({
			where: { id },
			data,
		});

		// Log action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "UPDATE_ANNOUNCEMENT",
			targetType: "announcement",
			targetId: announcement.id,
			summary: `Updated announcement "${announcement.title}"`,
			metadata: {
				changes: updateData,
			},
		});

		return { success: true, announcement };
	});
