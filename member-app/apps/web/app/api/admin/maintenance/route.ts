import { db } from "@repo/database";
import { getSession } from "@saas/auth/lib/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const maintenanceSchema = z.object({
	enabled: z.boolean().optional(),
	estimatedEndTime: z.string().nullable().optional(),
});

export async function GET() {
	try {
		const [modeSetting, endTimeSetting] = await Promise.all([
			db.systemSetting.findUnique({
				where: { key: "maintenance_mode" },
			}),
			db.systemSetting.findUnique({
				where: { key: "maintenance_end_time" },
			}),
		]);

		return NextResponse.json({
			enabled: modeSetting?.value === "true",
			estimatedEndTime: endTimeSetting?.value ?? null,
			updatedAt: modeSetting?.updatedAt?.toISOString() ?? null,
		});
	} catch {
		return NextResponse.json(
			{ error: "Failed to fetch maintenance status" },
			{ status: 500 },
		);
	}
}

export async function POST(request: Request) {
	const session = await getSession();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const isAdmin =
		session.user.role === "owner" ||
		session.user.role === "admin" ||
		process.env.SUPER_ADMIN_EMAILS?.split(",")
			.map((e) => e.trim().toLowerCase())
			.includes(session.user.email?.toLowerCase() ?? "");

	if (!isAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	try {
		const body = await request.json();
		const parsed = maintenanceSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid request body" },
				{ status: 400 },
			);
		}

		const enabled = Boolean(parsed.data.enabled);

		await db.systemSetting.upsert({
			where: { key: "maintenance_mode" },
			create: { key: "maintenance_mode", value: String(enabled) },
			update: { value: String(enabled) },
		});

		// Update estimated end time if provided
		if (parsed.data.estimatedEndTime !== undefined) {
			if (parsed.data.estimatedEndTime) {
				await db.systemSetting.upsert({
					where: { key: "maintenance_end_time" },
					create: {
						key: "maintenance_end_time",
						value: parsed.data.estimatedEndTime,
					},
					update: { value: parsed.data.estimatedEndTime },
				});
			} else {
				// Clear the end time
				await db.systemSetting
					.delete({ where: { key: "maintenance_end_time" } })
					.catch(() => {});
			}
		}

		return NextResponse.json({ enabled });
	} catch {
		return NextResponse.json(
			{ error: "Failed to update maintenance status" },
			{ status: 500 },
		);
	}
}
