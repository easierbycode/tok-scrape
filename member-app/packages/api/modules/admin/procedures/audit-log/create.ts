import { db } from "@repo/database";
import type { Prisma } from "@repo/database/prisma/generated/client";
import type { AuditAction } from "@repo/database/prisma/zod";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const create = adminProcedure
	.route({
		method: "POST",
		path: "/admin/audit-log/create",
		tags: ["Administration"],
		summary: "Create an audit log entry",
	})
	.input(
		z.object({
			adminUserId: z.string(),
			adminEmail: z.string().email().optional(),
			adminName: z.string().optional(), // For display
			actionType: z.string(),
			targetEntity: z.enum([
				"user",
				"subscription",
				"announcement",
				"affiliate",
				"content",
			]),
			targetId: z.string(),
			targetName: z.string().optional(),
			previousValue: z.string().optional(),
			newValue: z.string().optional(),
			reason: z.string().optional(),
			metadata: z.record(z.string(), z.any()).optional(),
			ipAddress: z.string().optional(),
		}),
	)
	.handler(async ({ input }) => {
		// Build metadata object
		const metadata: Record<string, unknown> = {};
		if (input.targetName) {
			metadata.targetName = input.targetName;
		}
		if (input.previousValue) {
			metadata.previousValue = input.previousValue;
		}
		if (input.newValue) {
			metadata.newValue = input.newValue;
		}
		if (input.reason) {
			metadata.reason = input.reason;
		}
		if (input.ipAddress) {
			metadata.ipAddress = input.ipAddress;
		}
		if (input.metadata) {
			Object.assign(metadata, input.metadata);
		}

		const entry = await db.auditLog.create({
			data: {
				adminUserId: input.adminUserId,
				action: input.actionType as AuditAction,
				targetType: input.targetEntity,
				targetId: input.targetId,
				metadata: metadata as Prisma.InputJsonValue,
			},
		});

		return { success: true, id: entry.id };
	});
