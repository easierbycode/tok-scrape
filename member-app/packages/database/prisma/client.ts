import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";
import { logger } from "@repo/logs";

const prismaClientSingleton = () => {
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not set");
	}

	// Use connection pooling for serverless environments
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		// Limit connections in serverless
		max: 1, // Each serverless function should use max 1 connection
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 10000,
		// Kill any query that exceeds 8 seconds at the node driver level.
		// This is the outer safety net that prevents hung connections from
		// blocking the Lambda for minutes when Postgres has lock contention.
		query_timeout: 8000,
	});

	const adapter = new PrismaPg(pool);

	const client = new PrismaClient({
		adapter,
		log: [
			{ level: "query", emit: "event" },
			{ level: "error", emit: "stdout" },
			{ level: "warn", emit: "stdout" },
		],
	});

	// Add slow query logging in production
	if (process.env.NODE_ENV === "production") {
		client.$on("query" as never, (e: { query: string; duration: number; timestamp: Date }) => {
			if (e.duration > 2000) {
				// Queries over 2 seconds
				logger.warn("Slow query detected", {
					query: e.query,
					duration: e.duration,
					timestamp: e.timestamp,
				});
			}
		});
	}

	return client;
};

declare global {
	var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

// biome-ignore lint/suspicious/noRedeclare: This is a singleton
const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
	globalThis.prisma = prisma;
}

export { prisma as db };
