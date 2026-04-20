import { canUseAdminProcedure } from "@repo/api/lib/roles";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getSession } from "@saas/auth/lib/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const announcementSchema = z.object({
	id: z.string().optional(),
	type: z.string().min(1),
	title: z.string().min(1),
	content: z.string().min(1),
	enabled: z.boolean().optional(),
	priority: z.string().optional(),
});

function isAuthorizedAdmin(user: {
	email: string;
	role?: string | null;
}): boolean {
	const superAdmins =
		process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
			e.trim().toLowerCase(),
		) || [];
	const isSuperAdmin = superAdmins.includes(user.email.toLowerCase());
	return isSuperAdmin || canUseAdminProcedure(user.role);
}

export async function GET(_request: NextRequest) {
	try {
		const session = await getSession();

		if (!session?.user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		if (!isAuthorizedAdmin(session.user)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const siteWide = await db.globalAnnouncement.findFirst({
			where: { type: "site-wide" },
			orderBy: { updatedAt: "desc" },
		});

		const onboarding = await db.globalAnnouncement.findFirst({
			where: { type: "onboarding" },
			orderBy: { updatedAt: "desc" },
		});

		return NextResponse.json({
			siteWide,
			onboarding,
		});
	} catch (error) {
		logger.error("Load announcements error", { error });
		return NextResponse.json({ error: "Failed to load" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await getSession();

		if (!session?.user) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		if (!isAuthorizedAdmin(session.user)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const parsed = announcementSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Missing or invalid required fields" },
				{ status: 400 },
			);
		}

		const { type, id, title, content, enabled, priority } = parsed.data;

		const announcement = id
			? await db.globalAnnouncement.update({
					where: { id },
					data: {
						title,
						content,
						enabled,
						priority: priority || "normal",
						lastEditBy: session.user.id,
					},
				})
			: await db.globalAnnouncement.create({
					data: {
						type,
						title,
						content,
						enabled,
						priority: priority || "normal",
						createdBy: session.user.id,
					},
				});

		return NextResponse.json(announcement);
	} catch (error) {
		logger.error("Save announcement error", { error });
		return NextResponse.json({ error: "Failed to save" }, { status: 500 });
	}
}
