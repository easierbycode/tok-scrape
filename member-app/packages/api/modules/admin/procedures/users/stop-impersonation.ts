import { ORPCError } from "@orpc/server";
import { getUserById } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc/procedures";

export const stopImpersonation = protectedProcedure
	.route({
		method: "POST",
		path: "/admin/users/stop-impersonation",
		tags: ["Administration"],
		summary: "Stop impersonating a user",
		description:
			"Exits impersonation mode and logs the action to audit trail",
	})
	.input(
		z.object({
			impersonatedUserId: z.string().min(1, "User ID is required"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { impersonatedUserId } = input;

		// During impersonation the session user is the impersonated user, not the admin.
		// impersonatedBy holds the real admin's user ID for the audit log.
		const adminUserId = (context.session as any).impersonatedBy as
			| string
			| undefined;

		if (!adminUserId) {
			throw new ORPCError("FORBIDDEN", {
				message: "No active impersonation session",
			});
		}

		// Get impersonated user info for audit log
		const impersonatedUser = await getUserById(impersonatedUserId);
		if (!impersonatedUser) {
			throw new ORPCError("NOT_FOUND", {
				message: "Impersonated user not found",
			});
		}

		await logAdminAction({
			adminUserId,
			action: "STOP_IMPERSONATION",
			targetType: "user",
			targetId: impersonatedUserId,
			summary: `Stopped impersonating ${impersonatedUser.email}`,
			metadata: {
				impersonatedUserEmail: impersonatedUser.email,
				impersonatedUserName: impersonatedUser.name,
				stoppedAt: new Date().toISOString(),
			},
		});

		return {
			success: true,
			message: "Impersonation stopped and logged",
		};
	});




