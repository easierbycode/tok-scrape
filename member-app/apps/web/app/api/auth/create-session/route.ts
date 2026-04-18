import { randomBytes } from "node:crypto";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const createSessionSchema = z.object({
	token: z.string().min(1),
	userId: z.string().min(1),
});

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const parsed = createSessionSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Missing or invalid token/userId" },
				{ status: 400 },
			);
		}

		const { token, userId } = parsed.data;

		// Verify token is valid and belongs to user
		const loginToken = await db.loginToken.findFirst({
			where: {
				token,
				userId,
				used: false,
				expiresAt: { gt: new Date() },
			},
		});

		if (!loginToken) {
			return NextResponse.json(
				{ error: "Invalid or expired token" },
				{ status: 401 },
			);
		}

		// Get user
		const user = await db.user.findUnique({ where: { id: userId } });
		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 },
			);
		}

		// Create session using better-auth's internal API
		// Generate session token
		const sessionToken = randomBytes(32).toString("hex");
		const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000); // 30 days

		// Create session in database
		const _session = await db.session.create({
			data: {
				token: sessionToken,
				userId: user.id,
				expiresAt,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		// Mark login token as used
		await db.loginToken.update({
			where: { id: loginToken.id },
			data: { used: true },
		});

		// Create response with session cookie
		const response = NextResponse.json({ success: true });

		// Set better-auth session cookie
		const cookieName = "better-auth.session_token";
		response.cookies.set(cookieName, sessionToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			expires: expiresAt,
		});

		return response;
	} catch (error) {
		logger.error("Create session error", { error });
		return NextResponse.json(
			{ error: "Failed to create session" },
			{ status: 500 },
		);
	}
}
