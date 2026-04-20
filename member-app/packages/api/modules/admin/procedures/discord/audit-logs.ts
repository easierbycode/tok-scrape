import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const AuditLogsInputSchema = z.object({
	searchTerm: z.string().optional(),
	limit: z.number().int().positive().optional().default(100),
});

export const getDiscordAuditLogs = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/audit-logs",
		tags: ["Administration"],
		summary: "Get Discord audit logs",
	})
	.input(AuditLogsInputSchema)
	.handler(async ({ input }) => {
		const { searchTerm, limit } = input;

		const where = searchTerm
			? {
					OR: [
						{
							discordUsername: {
								contains: searchTerm,
								mode: "insensitive" as const,
							},
						},
						{ discordId: { contains: searchTerm } },
						{
							user: {
								email: {
									contains: searchTerm,
									mode: "insensitive" as const,
								},
							},
						},
						{
							user: {
								name: {
									contains: searchTerm,
									mode: "insensitive" as const,
								},
							},
						},
					],
				}
			: {};

		const logs = await db.discordAudit.findMany({
			where,
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
			take: limit,
		});

		return { logs };
	});

