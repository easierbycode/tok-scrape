import { ORPCError } from "@orpc/server";
import { requestUserDeletion } from "@repo/database/lib/gdpr-deletion";
import { getUserById } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const deleteUser = adminProcedure
	.route({
		method: "DELETE",
		path: "/admin/users/delete",
		tags: ["Administration"],
		summary: "Delete a user",
		description:
			"Soft-deletes a user with GDPR compliance. PII is anonymized immediately; full purge after 30-day grace period.",
	})
	.input(
		z.object({
			userId: z.string().min(1, "User ID is required"),
			reason: z
				.enum(["user_request", "admin_action", "gdpr"])
				.default("admin_action"),
			immediate: z.boolean().optional().default(false),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, reason, immediate } = input;

		const user = await getUserById(userId);
		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		try {
			const result = await requestUserDeletion({
				userId,
				deletedBy: context.user.id,
				reason,
				immediate,
			});
			return result;
		} catch (error) {
			console.error("Failed to delete user:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error ? error.message : "Failed to delete user",
			});
		}
	});




