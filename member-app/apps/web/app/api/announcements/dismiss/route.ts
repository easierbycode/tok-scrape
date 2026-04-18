import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getSession } from "@saas/auth/lib/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const dismissSchema = z.object({
	announcementId: z.string().min(1),
});

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();

		if (!session?.user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const body = await request.json();
		const parsed = dismissSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Missing or invalid announcementId" },
				{ status: 400 },
			);
		}

		const { announcementId } = parsed.data;

		await db.globalAnnouncementView.upsert({
			where: {
				announcementId_userId: {
					announcementId,
					userId: session.user.id,
				},
			},
			update: {
				dismissed: true,
				dismissedAt: new Date(),
			},
			create: {
				announcementId,
				userId: session.user.id,
				dismissed: true,
				dismissedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		logger.error("Dismiss announcement error", { error });
		return NextResponse.json(
			{ error: "Failed to dismiss" },
			{ status: 500 },
		);
	}
}
