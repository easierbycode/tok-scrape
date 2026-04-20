import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { z } from "zod";
import { publicProcedure } from "../../../orpc/procedures";

/**
 * Validate Setup Token Procedure
 *
 * Validates a setup account token and returns the associated email
 * without deleting the token (that happens in setup-account).
 */
export const validateSetupToken = publicProcedure
	.route({
		method: "POST",
		path: "/users/validate-setup-token",
		tags: ["Users"],
		summary: "Validate setup account token",
		description: "Validates token and returns email without consuming it",
	})
	.input(
		z.object({
			token: z.string().min(1, "Token is required"),
		}),
	)
	.handler(async ({ input }) => {
		const { token } = input;

		// Find verification record
		const verification = await db.verification.findFirst({
			where: {
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

		return {
			email: verification.identifier,
			valid: true,
		};
	});

