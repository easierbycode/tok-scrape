import { Prisma } from "../prisma/generated/client";
import { logger } from "@repo/logs";
import * as Sentry from "@sentry/nextjs";

export interface UserFriendlyError {
	userMessage: string;
	shouldRetry: boolean;
	isTemporary: boolean;
}

export async function wrapDatabaseQuery<T>(
	queryFn: () => Promise<T>,
	context: {
		operation: string;
		userId?: string;
		route?: string;
	},
): Promise<{ data?: T; error?: UserFriendlyError }> {
	try {
		const data = await queryFn();
		return { data };
	} catch (error) {
		// Log detailed error for troubleshooting
		logger.error("Database operation failed", {
			operation: context.operation,
			userId: context.userId,
			route: context.route,
			error: error instanceof Error ? error.message : "Unknown error",
			code:
				error instanceof Prisma.PrismaClientKnownRequestError
					? error.code
					: undefined,
			timestamp: new Date().toISOString(),
		});

		// Report to Sentry with context
		Sentry.captureException(error, {
			tags: {
				operation: context.operation,
				route: context.route || "unknown",
			},
			extra: {
				userId: context.userId,
				prismaCode:
					error instanceof Prisma.PrismaClientKnownRequestError
						? error.code
						: undefined,
			},
		});

		// Determine user-friendly message
		const userError = translateDatabaseError(error);

		return { error: userError };
	}
}

function translateDatabaseError(error: unknown): UserFriendlyError {
	// Connection/timeout errors (temporary, should retry)
	if (
		error instanceof Prisma.PrismaClientInitializationError ||
		error instanceof Prisma.PrismaClientUnknownRequestError ||
		(error instanceof Error &&
			(error.message.includes("timeout") ||
				error.message.includes("P2024") ||
				error.message.includes("connection")))
	) {
		return {
			userMessage:
				"We're having trouble connecting to our servers. Please try again in a moment.",
			shouldRetry: true,
			isTemporary: true,
		};
	}

	// Known request errors (usually permanent, don't retry)
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		switch (error.code) {
			case "P2002":
				return {
					userMessage:
						"This information already exists. Please use different details.",
					shouldRetry: false,
					isTemporary: false,
				};
			case "P2025":
				return {
					userMessage:
						"The requested information could not be found.",
					shouldRetry: false,
					isTemporary: false,
				};
			case "P2003":
				return {
					userMessage:
						"This action cannot be completed due to related data.",
					shouldRetry: false,
					isTemporary: false,
				};
			default:
				return {
					userMessage:
						"We encountered an unexpected issue. Our team has been notified.",
					shouldRetry: false,
					isTemporary: false,
				};
		}
	}

	// Unknown errors (log and show generic message)
	return {
		userMessage:
			"Something went wrong. Please try again or contact support if this persists.",
		shouldRetry: true,
		isTemporary: false,
	};
}
