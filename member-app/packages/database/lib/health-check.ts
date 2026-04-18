import { db } from "../prisma/client";

export async function checkDatabaseHealth(): Promise<{
	healthy: boolean;
	latency?: number;
	error?: string;
}> {
	try {
		const start = Date.now();
		await db.$queryRaw`SELECT 1`;
		const latency = Date.now() - start;

		return { healthy: true, latency };
	} catch (error) {
		return {
			healthy: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
