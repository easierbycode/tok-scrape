import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const AdditionalAccountsInputSchema = z.object({
	searchTerm: z.string().optional(),
	activeOnly: z.boolean().optional().default(false),
});

export const getAdditionalDiscordAccounts = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/additional-accounts",
		tags: ["Administration"],
		summary: "Get additional Discord accounts",
	})
	.input(AdditionalAccountsInputSchema)
	.handler(async ({ input }) => {
		const { searchTerm, activeOnly } = input;

		const where = {
			...(activeOnly ? { active: true } : {}),
			...(searchTerm
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
								primaryUser: {
									email: {
										contains: searchTerm,
										mode: "insensitive" as const,
									},
								},
							},
						],
					}
				: {}),
		};

		const accounts = await db.additionalDiscordAccount.findMany({
			where,
			include: {
				primaryUser: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
			orderBy: { addedAt: "desc" },
		});

		return { accounts };
	});

