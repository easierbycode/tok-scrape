import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";
import { sendSetupAccountEmail } from "./send-setup-account-email";

export const resendSetupAccountEmail = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/resend-setup-account-email",
		tags: ["Administration"],
		summary: "Resend setup-account email (24h link)",
	})
	.input(
		z.object({
			userId: z.string().min(1),
		}),
	)
	.handler(async ({ input, context }) => {
		const user = await db.user.findFirst({
			where: { id: input.userId, deletedAt: null },
		});

		if (!user) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		if (user.emailVerified) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Email is already verified",
			});
		}

		const credentialAccount = await db.account.findFirst({
			where: {
				userId: user.id,
				providerId: "credential",
			},
		});

		if (credentialAccount) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					"User already has a password. Use forgot password instead.",
			});
		}

		try {
			await sendSetupAccountEmail({
				email: user.email,
				name: user.name,
			});
		} catch (error) {
			console.error("Failed to resend setup account email:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to send email",
			});
		}

		await logAdminAction({
			adminUserId: context.user.id,
			action: "RESEND_SETUP_ACCOUNT_EMAIL",
			targetType: "user",
			targetId: user.id,
			summary: `Resent setup-account email to ${user.email}`,
			metadata: { email: user.email },
		});

		return { success: true as const };
	});
