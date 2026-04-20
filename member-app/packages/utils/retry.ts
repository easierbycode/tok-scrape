import { logger } from "@repo/logs";

export interface RetryOptions {
	maxRetries?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	backoffMultiplier?: number;
	shouldRetry?: (error: unknown) => boolean;
	onRetry?: (attempt: number, error: unknown) => void;
}

export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		initialDelayMs = 1000,
		maxDelayMs = 10000,
		backoffMultiplier = 2,
		shouldRetry = isDatabaseErrorRetryable,
		onRetry,
	} = options;

	let lastError: unknown;
	let delay = initialDelayMs;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt === maxRetries || !shouldRetry(error)) {
				throw error;
			}

			if (onRetry) {
				onRetry(attempt + 1, error);
			}

			logger.warn("Retrying operation", {
				attempt: attempt + 1,
				maxRetries,
				delay,
				error: error instanceof Error ? error.message : "Unknown error",
			});

			await new Promise((resolve) => setTimeout(resolve, delay));
			delay = Math.min(delay * backoffMultiplier, maxDelayMs);
		}
	}

	throw lastError;
}

export function isDatabaseErrorRetryable(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("connection") ||
			message.includes("econnrefused") ||
			message.includes("p2024") ||
			message.includes("pool") ||
			message.includes("503") ||
			message.includes("network")
		);
	}
	return false;
}
