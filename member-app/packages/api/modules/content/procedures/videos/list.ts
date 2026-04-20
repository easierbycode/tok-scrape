import { db } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const listVideos = protectedProcedure
	.input(
		z
			.object({
				category: z.string().optional(),
				search: z.string().optional(),
			})
			.optional(),
	)
	.handler(async ({ input }) => {
		const videos = await db.contentVideo.findMany({
			where: {
				published: true,
				...(input?.category && { category: input.category }),
				...(input?.search && {
					OR: [
						{
							title: {
								contains: input.search,
								mode: "insensitive",
							},
						},
						{
							description: {
								contains: input.search,
								mode: "insensitive",
							},
						},
					],
				}),
			},
			orderBy: { orderIndex: "asc" },
		});

		return { videos };
	});
