import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";

function isRetryableError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("timeout") ||
			message.includes("connection") ||
			message.includes("network") ||
			message.includes("503") ||
			message.includes("fetch failed") ||
			message.includes("econnrefused")
		);
	}
	// Retry on network-level failures (no response)
	if (error instanceof TypeError && error.message === "Failed to fetch") {
		return true;
	}
	return false;
}

export function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 60 * 1000,
				retry: (failureCount, error) => {
					// Max 2 retries, only for connection/timeout errors
					if (failureCount >= 2) {
						return false;
					}
					return isRetryableError(error);
				},
				retryDelay: (attemptIndex) =>
					Math.min(1000 * 2 ** attemptIndex, 10000),
			},
			dehydrate: {
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
		},
	});
}

export function createQueryKeyWithParams(
	key: string | string[],
	params: Record<string, string | number>,
) {
	return [
		...(Array.isArray(key) ? key : [key]),
		Object.entries(params)
			.reduce((acc, [key, value]) => {
				acc.push(`${key}:${value}`);
				return acc;
			}, [] as string[])
			.join("_"),
	] as const;
}
