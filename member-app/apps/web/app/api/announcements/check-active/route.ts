import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getSession } from "@saas/auth/lib/server";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
	try {
		const session = await getSession();

		if (!session?.user) {
			return NextResponse.json({ hasAnnouncement: false });
		}

		const announcement = await db.globalAnnouncement.findFirst({
			where: {
				type: "site-wide",
				enabled: true,
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		if (!announcement) {
			return NextResponse.json({ hasAnnouncement: false });
		}

		const view = await db.globalAnnouncementView.findUnique({
			where: {
				announcementId_userId: {
					announcementId: announcement.id,
					userId: session.user.id,
				},
			},
		});

		return NextResponse.json({
			hasAnnouncement: true,
			dismissed: view?.dismissed ?? false,
			announcement: {
				id: announcement.id,
				title: announcement.title,
				content: announcement.content,
				priority: announcement.priority,
			},
		});
	} catch (error) {
		logger.error("Check announcement error", { error });
		return NextResponse.json({ hasAnnouncement: false });
	}
}
