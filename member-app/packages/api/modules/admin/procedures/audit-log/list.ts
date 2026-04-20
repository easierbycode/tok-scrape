import { db } from "@repo/database";
import type { Prisma } from "@repo/database/prisma/generated/client";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const list = adminProcedure
	.route({
		method: "GET",
		path: "/admin/audit-log/list",
		tags: ["Administration"],
		summary: "Get audit log entries with filtering",
	})
	.input(
		z.object({
			actionType: z.string().optional(),
			adminUserId: z.string().optional(),
			targetEntity: z.string().optional(),
			startDate: z.string().optional(),
			endDate: z.string().optional(),
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
	)
	.handler(async ({ input }) => {
		// Build where clause
		const where: Prisma.AuditLogWhereInput = {};

		if (input.actionType) {
			// Convert to uppercase to match Prisma enum (e.g., "grant_access" -> "GRANT_ACCESS")
			where.action = input.actionType.toUpperCase() as any;
		}

		if (input.adminUserId) {
			where.adminUserId = input.adminUserId;
		}

		if (input.targetEntity) {
			where.targetType = input.targetEntity;
		}

		// Date range filter
		if (input.startDate || input.endDate) {
			where.createdAt = {};
			if (input.startDate) {
				where.createdAt.gte = new Date(input.startDate);
			}
			if (input.endDate) {
				where.createdAt.lte = new Date(input.endDate);
			}
		}

		// Pagination
		const page = input.page || 1;
		const limit = input.limit || 50;
		const skip = (page - 1) * limit;

		// Get logs with admin user info
		const [logs, totalActions, last24h] = await Promise.all([
			db.auditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					adminUser: {
						select: {
							id: true,
							name: true,
							email: true,
							role: true,
						},
					},
				},
			}),
			db.auditLog.count({ where }),
			db.auditLog.count({
				where: {
					createdAt: {
						gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
					},
				},
			}),
		]);

		// Get unique admin count
		const uniqueAdminsResult = await db.auditLog.groupBy({
			by: ["adminUserId"],
			where,
		});
		const uniqueAdmins = uniqueAdminsResult.length;

		// Get most active admin
		const mostActiveAdminData = await db.auditLog.groupBy({
			by: ["adminUserId"],
			_count: {
				adminUserId: true,
			},
			where,
			orderBy: {
				_count: {
					adminUserId: "desc",
				},
			},
			take: 1,
		});

		let mostActiveAdmin = { name: "N/A", count: 0 };
		if (mostActiveAdminData.length > 0) {
			const adminUser = await db.user.findUnique({
				where: { id: mostActiveAdminData[0].adminUserId },
				select: { name: true },
			});
			mostActiveAdmin = {
				name: adminUser?.name || "Unknown Admin",
				count: mostActiveAdminData[0]._count.adminUserId,
			};
		}

		// Get most common action
		const mostCommonActionData = await db.auditLog.groupBy({
			by: ["action"],
			_count: {
				action: true,
			},
			where,
			orderBy: {
				_count: {
					action: "desc",
				},
			},
			take: 1,
		});

		const mostCommonAction = {
			type:
				mostCommonActionData.length > 0
					? mostCommonActionData[0].action
					: "N/A",
			count:
				mostCommonActionData.length > 0
					? mostCommonActionData[0]._count.action
					: 0,
		};

		// Batch-fetch all user targets in a single query instead of N individual lookups
		const userTargetIds = [
			...new Set(
				logs
					.filter((log) => log.targetType === "user")
					.map((log) => log.targetId),
			),
		];

		const userTargetMap = new Map<
			string,
			{ name: string | null; email: string }
		>();
		if (userTargetIds.length > 0) {
			const users = await db.user.findMany({
				where: { id: { in: userTargetIds } },
				select: { id: true, name: true, email: true },
			});
			for (const u of users) {
				userTargetMap.set(u.id, { name: u.name, email: u.email });
			}
		}

		// Transform to match frontend expectations
		const transformedLogs = logs.map((log) => {
			let targetName: string | undefined;

			if (log.targetType === "user") {
				const targetUser = userTargetMap.get(log.targetId);
				targetName = targetUser?.name || targetUser?.email || undefined;
			}

			const rawMetadata =
				log.metadata && typeof log.metadata === "object"
					? (log.metadata as Record<string, unknown>)
					: {};
			if (!targetName) {
				targetName =
					(typeof rawMetadata.targetName === "string"
						? rawMetadata.targetName
						: undefined) ||
					(typeof rawMetadata.name === "string"
						? rawMetadata.name
						: undefined) ||
					(typeof rawMetadata.title === "string"
						? rawMetadata.title
						: undefined);
			}

			const summary =
				typeof rawMetadata.summary === "string"
					? rawMetadata.summary
					: undefined;

			return {
				id: log.id,
				adminUserId: log.adminUserId,
				adminName: log.adminUser.name,
				adminEmail: log.adminUser.email,
				actionType: log.action,
				targetEntity: log.targetType,
				targetId: log.targetId,
				targetName,
				metadata: rawMetadata,
				summary,
				timestamp: log.createdAt.toISOString(),
			};
		});

		return {
			logs: transformedLogs,
			stats: {
				totalActions,
				uniqueAdmins,
				last24Hours: last24h,
				mostActiveAdmin,
				mostCommonAction,
			},
			total: totalActions,
			page,
			limit,
		};
	});
