import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import {
	type AppRole,
	ASSIGNABLE_APP_ROLES,
	ROLES,
} from "../../../../lib/roles";
import { adminProcedure } from "../../../../orpc/procedures";

/**
 * Assign Role Procedure
 *
 * Updates user role directly via Prisma (not Better-Auth).
 * User must logout/login for role change to take effect.
 */

const assignRoleEnum = z.enum(ASSIGNABLE_APP_ROLES);

const AssignRoleInputSchema = z.object({
	userId: z.string().min(1),
	role: assignRoleEnum.nullish(),
});

function formatRoleForSummary(r: string | null): string {
	if (!r || r === ROLES.USER) {
		return "user";
	}
	return r;
}

export const assignRole = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/assign-role",
		tags: ["Administration"],
		summary: "Assign role to a user",
	})
	.input(AssignRoleInputSchema)
	.handler(async ({ input, context }) => {
		const { userId } = input;
		const nextRole: AppRole = input.role ?? ROLES.USER;

		const target = await db.user.findFirst({
			where: { id: userId, deletedAt: null },
			select: { email: true, role: true },
		});

		if (!target) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		const previousRole = target.role ?? null;

		await db.user.update({
			where: { id: userId },
			data: { role: nextRole },
		});

		const prevLabel = formatRoleForSummary(previousRole);
		const nextLabel = formatRoleForSummary(nextRole);

		await logAdminAction({
			adminUserId: context.user.id,
			action: "ASSIGN_ROLE",
			targetType: "user",
			targetId: userId,
			summary: `Set role for ${target.email} from ${prevLabel} to ${nextLabel}`,
			metadata: {
				previousRole,
				newRole: nextRole,
			},
		});

		return {
			success: true,
			message: "User must logout/login to see role change",
		};
	});
