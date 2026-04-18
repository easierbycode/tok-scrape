import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";
import { sendSetupAccountEmail } from "./send-setup-account-email";

/**
 * Add User Procedure
 *
 * Creates a new user account. Access must be granted separately via grantAccess procedure.
 */

export const addUser = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/add",
		tags: ["Administration"],
		summary: "Add a new user",
	})
	.input(
		z.object({
			name: z.string().min(1, "Name is required"),
			email: z.string().email("Valid email is required"),
			role: z.enum(["admin"]).optional(),
			sendEmail: z.boolean().default(true),
		}),
	)
	.handler(async ({ input, context }) => {
		const { email, name, role, sendEmail: shouldSendEmail } = input;

		// Check if user already exists
		const existing = await db.user.findUnique({
			where: { email },
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message: "User already exists",
			});
		}

		// Create user
		const user = await db.user.create({
			data: {
				email,
				name,
				role: role || null,
				emailVerified: false,
				onboardingComplete: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		// Send setup account email if requested
		if (shouldSendEmail) {
			try {
				await sendSetupAccountEmail({
					email: user.email,
					name: user.name,
				});
			} catch (error) {
				// Log error but don't fail the operation
				console.error("Failed to send setup account email:", error);
			}
		}

		// Log action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CREATE_USER",
			targetType: "user",
			targetId: user.id,
			summary: `Created user account for ${email}`,
			metadata: { email, name, role },
		});

		return {
			success: true,
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
		};
	});
