import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const create = adminProcedure
	.route({
		method: "POST",
		path: "/admin/announcements/create",
		tags: ["Administration"],
		summary: "Create a new announcement",
	})
	.input(
		z.object({
			title: z.string().min(1).max(200),
			contentPreview: z.string().min(1).max(300).optional(),
			fullContent: z.string().min(1),
			type: z.enum([
				"welcome",
				"feature",
				"event",
				"maintenance",
				"community",
			]),
			priority: z
				.enum(["normal", "important", "urgent"])
				.default("normal"),
			author: z.string().optional(),
			published: z.boolean().default(false),
			expiresAt: z.string().datetime().optional().nullable(),
		}),
	)
	.handler(async ({ input, context }) => {
		const announcement = await db.announcement.create({
			data: {
				title: input.title,
				content: input.fullContent,
				type: input.type,
				priority: input.priority,
				publishedAt: input.published ? new Date() : null,
				expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
			},
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "CREATE_ANNOUNCEMENT",
			targetType: "announcement",
			targetId: announcement.id,
			summary: `Created announcement "${announcement.title}" (${announcement.type})`,
			metadata: {
				title: announcement.title,
				type: announcement.type,
				priority: announcement.priority,
			},
		});

		return { success: true, announcement };
	});
