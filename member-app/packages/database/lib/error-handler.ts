import { Prisma } from "../prisma/generated/client";
import { logger } from "@repo/logs";

export function handleDatabaseError(error: unknown): never {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		switch (error.code) {
			case "P2002":
				throw new Error("A record with this value already exists");
			case "P2025":
				throw new Error("Record not found");
			case "P2003":
				throw new Error("Foreign key constraint failed");
			default:
				logger.error("Database error", { code: error.code, meta: error.meta });
				throw new Error("Database operation failed");
		}
	}

	if (error instanceof Prisma.PrismaClientInitializationError) {
		logger.error("Database connection failed", { error });
		throw new Error("Unable to connect to database");
	}

	logger.error("Unknown database error", { error });
	throw new Error("An unexpected error occurred");
}
