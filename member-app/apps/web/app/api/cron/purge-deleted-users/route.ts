import { purgeScheduledDeletions } from "@repo/database/lib/gdpr-deletion";
import { logger } from "@repo/logs";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		return NextResponse.json(
			{ error: "CRON_SECRET not configured" },
			{ status: 500 },
		);
	}

	const authHeader = request.headers.get("authorization");
	if (authHeader !== `Bearer ${cronSecret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		logger.info("Starting scheduled user purge cron");
		const result = await purgeScheduledDeletions();
		logger.info("Purge completed", result);

		return NextResponse.json(result);
	} catch (error) {
		logger.error("Purge failed", { error });
		return NextResponse.json({ error: "Purge failed" }, { status: 500 });
	}
}
