import { ORPCError } from "@orpc/server";
import { restoreUser } from "@repo/database/lib/gdpr-deletion";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const restoreUserProcedure = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/restore",
		tags: ["Administration"],
		summary: "Restore deleted user",
		description: "Restores a soft-deleted user (only if data was not yet anonymized)",
	})
	.input(
		z.object({
			userId: z.string().min(1, "User ID is required"),
		}),
	)
	.handler(async ({ input, context }) => {
		try {
			const result = await restoreUser(input.userId, context.user.id);
			return result;
		} catch (error) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Failed to restore user",
			});
		}
	});
