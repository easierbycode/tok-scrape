import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const ImpersonateInputSchema = z.object({
	userId: z.string().min(1),
});

/**
 * Impersonate User Audit Procedure
 *
 * Logs impersonation attempts for audit trail.
 * The actual impersonation is handled by Better-Auth client on the frontend.
 * This procedure just validates permissions and creates the audit log.
 */
export const impersonate = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/impersonate",
		tags: ["Administration"],
		summary: "Log impersonation attempt (super admin only)",
	})
	.input(ImpersonateInputSchema)
	.handler(async ({ input, context }) => {
		// Only super admins can impersonate
		if (!context.isSuperAdmin) {
			throw new ORPCError("FORBIDDEN", {
				message: "Only super admins can impersonate users",
			});
		}

		const target = await db.user.findUnique({
			where: { id: input.userId },
			select: { email: true },
		});

		// Log action for audit trail
		// The actual impersonation is handled by authClient.admin.impersonateUser on the client
		await logAdminAction({
			adminUserId: context.user.id,
			action: "IMPERSONATE_USER",
			targetType: "user",
			targetId: input.userId,
			summary: `Started impersonation of ${target?.email ?? input.userId}`,
			metadata: {
				adminEmail: context.user.email,
			},
		});

		return {
			success: true,
			message: "Impersonation audit logged",
		};
	});
