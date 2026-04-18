import { logger } from "@repo/logs";
import { db } from "../prisma/client";
import type { Prisma } from "../prisma/generated/client";
import type { AuditAction } from "../prisma/zod";

/**
 * Audit log parameters for admin actions
 */
export interface AuditLogParams {
	adminUserId: string;
	action: AuditAction | string;
	targetType: string;
	targetId: string;
	/** Plain-English one-liner; merged into metadata.summary when not already set. */
	summary?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Log admin action to structured logs and the database.
 */
export async function logAdminAction(params: AuditLogParams): Promise<void> {
	const metadata: Record<string, unknown> = { ...(params.metadata || {}) };
	if (
		params.summary !== undefined &&
		params.summary !== "" &&
		metadata.summary === undefined
	) {
		metadata.summary = params.summary;
	}

	logger.info("[AuditLog] Admin action", {
		admin: params.adminUserId,
		action: params.action,
		target: `${params.targetType}:${params.targetId}`,
		metadata,
		timestamp: new Date().toISOString(),
	});

	try {
		await db.auditLog.create({
			data: {
				adminUserId: params.adminUserId,
				action: params.action as AuditAction,
				targetType: params.targetType,
				targetId: params.targetId,
				metadata: metadata as Prisma.InputJsonValue,
			},
		});
	} catch (error) {
		logger.error("[AuditLog] Failed to write to database", {
			error,
			adminUserId: params.adminUserId,
			action: params.action,
			target: `${params.targetType}:${params.targetId}`,
		});
	}
}
