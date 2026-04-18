interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 60 seconds
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of store.entries()) {
		if (entry.resetAt < now) {
			store.delete(key);
		}
	}
}, 60000);

export interface RateLimitOptions {
	limit: number; // Max requests
	windowMs: number; // Time window in milliseconds
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetAt: number;
}

export function checkRateLimit(
	key: string,
	options: RateLimitOptions,
): RateLimitResult {
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || entry.resetAt < now) {
		// First request or window expired - create new entry
		const resetAt = now + options.windowMs;
		store.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: options.limit - 1, resetAt };
	}

	if (entry.count >= options.limit) {
		// Rate limit exceeded
		return { allowed: false, remaining: 0, resetAt: entry.resetAt };
	}

	// Increment counter
	entry.count++;
	store.set(key, entry);
	return {
		allowed: true,
		remaining: options.limit - entry.count,
		resetAt: entry.resetAt,
	};
}
