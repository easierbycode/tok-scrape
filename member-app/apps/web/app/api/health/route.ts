import { checkDatabaseHealth } from "@repo/database/lib/health-check";
import { NextResponse } from "next/server";

export async function GET() {
	const dbHealth = await checkDatabaseHealth();

	return NextResponse.json(
		{
			status: dbHealth.healthy ? "healthy" : "unhealthy",
			database: dbHealth,
			timestamp: new Date().toISOString(),
		},
		{
			status: dbHealth.healthy ? 200 : 503,
		},
	);
}
