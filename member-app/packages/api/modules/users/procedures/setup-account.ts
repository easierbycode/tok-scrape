import { ORPCError } from "@orpc/server";
import { auth } from "@repo/auth";
import { db, createUserAccount, getUserByEmail } from "@repo/database";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

/**
 * Setup Account Procedure
 *
 * Allows admin-created users to set their password after email verification.
 * This creates a credential account for the user.
 */
export const setupAccount = publicProcedure
	.route({
		method: "POST",
		path: "/users/setup-account",
		tags: ["Users"],
		summary: "Set up account password",
		description:
			"Set password for admin-created user after email verification",
	})
	.input(
		z.object({
			email: z.string().email("Valid email is required"),
			password: z.string().min(8, "Password must be at least 8 characters"),
			token: z.string().min(1, "Token is required"),
		}),
	)
	.handler(async ({ input }) => {
		const { email, password, token } = input;

		// Verify token exists and hasn't expired
		const verification = await db.verification.findFirst({
			where: {
				identifier: email,
				value: token,
				expiresAt: {
					gt: new Date(),
				},
			},
		});

		if (!verification) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Invalid or expired token",
			});
		}

		// Fetch user by email
		const user = await getUserByEmail(email);

		if (!user) {
			throw new ORPCError("NOT_FOUND", {
				message: "User not found",
			});
		}

		// Mark email as verified using the token
		if (!user.emailVerified) {
			await db.user.update({
				where: { id: user.id },
				data: { emailVerified: true },
			});
		}

		// Check if user already has a credential account
		const existingAccount = await db.account.findFirst({
			where: {
				userId: user.id,
				providerId: "credential",
			},
		});

		if (existingAccount) {
			throw new ORPCError("CONFLICT", {
				message:
					"Account already has a password. Please use the forgot password flow instead.",
			});
		}

		// Hash password using Better-Auth context
		const authContext = await auth.$context;
		const hashedPassword = await authContext.password.hash(password);

		// Create credential account
		await createUserAccount({
			userId: user.id,
			providerId: "credential",
			accountId: user.id,
			hashedPassword,
		});

		// Delete the verification token (one-time use)
		await db.verification.delete({
			where: { id: verification.id },
		});

		return {
			success: true,
			message: "Account setup complete",
		};
	});

