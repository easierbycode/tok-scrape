import { ORPCError } from "@orpc/server";
import { logger } from "@repo/logs";
import { checkRateLimit, type RateLimitOptions } from "../../lib/rate-limit";

export function rateLimitMiddleware(options: RateLimitOptions) {
	return async ({ context, next }: any) => {
		// Generate key from user ID or IP
		const userId = context.user?.id;
		const ip =
			context.headers.get("x-forwarded-for") ||
			context.headers.get("x-real-ip") ||
			"unknown";
		const key = userId || ip;

		const result = checkRateLimit(key, options);

		if (!result.allowed) {
			const resetInSeconds = Math.ceil(
				(result.resetAt - Date.now()) / 1000,
			);
			logger.warn("Rate limit exceeded", {
				key,
				limit: options.limit,
				windowMs: options.windowMs,
				resetInSeconds,
			});

			throw new ORPCError("TOO_MANY_REQUESTS", {
				message: `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
			});
		}

		return next({
			context: {
				...context,
				rateLimit: {
					remaining: result.remaining,
					resetAt: result.resetAt,
				},
			},
		});
	};
}
