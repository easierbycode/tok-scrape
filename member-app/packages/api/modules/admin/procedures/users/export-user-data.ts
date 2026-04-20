import { ORPCError } from "@orpc/server";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { exportUserData } from "@repo/database/lib/gdpr-deletion";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

export const exportUserDataProcedure = adminProcedure
	.route({
		method: "GET",
		path: "/admin/users/export-data",
		tags: ["Administration"],
		summary: "Export user data",
		description: "Exports all user data for GDPR Right to Data Portability",
	})
	.input(
		z.object({
			userId: z.string().min(1, "User ID is required"),
		}),
	)
	.handler(async ({ input, context }) => {
		try {
			const data = await exportUserData(input.userId);
			await logAdminAction({
				adminUserId: context.user.id,
				action: "EXPORT_USER_DATA",
				targetType: "user",
				targetId: input.userId,
				summary: `Exported personal data for ${data.profile.email}`,
				metadata: { email: data.profile.email },
			});
			return data;
		} catch (error) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Failed to export user data",
			});
		}
	});
