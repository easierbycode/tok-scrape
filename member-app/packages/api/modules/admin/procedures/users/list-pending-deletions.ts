import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const listPendingDeletions = adminProcedure
	.route({
		method: "GET",
		path: "/admin/users/pending-deletions",
		tags: ["Administration"],
		summary: "List users scheduled for deletion",
		description:
			"Returns users with deletedAt set, scheduled for purge after grace period",
	})
	.input(z.object({}).optional())
	.handler(async () => {
		const users = await db.user.findMany({
			where: {
				deletedAt: { not: null },
				scheduledPurgeAt: { not: null },
			},
			select: {
				id: true,
				name: true,
				email: true,
				deletedAt: true,
				deletedBy: true,
				deletionReason: true,
				scheduledPurgeAt: true,
			},
			orderBy: { scheduledPurgeAt: "asc" },
		});

		const now = new Date();
		return users.map((u) => ({
			...u,
			daysRemaining: u.scheduledPurgeAt
				? Math.ceil(
						(u.scheduledPurgeAt.getTime() - now.getTime()) /
							(1000 * 60 * 60 * 24),
					)
				: null,
		}));
	});
