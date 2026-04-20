import { logger } from "@repo/logs";

export class RateLimiter {
	private queue: number[] = [];

	constructor(
		private maxRequests: number,
		private windowMs: number,
	) {}

	async wait(): Promise<void> {
		const now = Date.now();

		// Remove requests outside the window
		this.queue = this.queue.filter((time) => now - time < this.windowMs);

		// If at limit, wait for oldest to expire
		if (this.queue.length >= this.maxRequests) {
			const oldestTime = this.queue[0];
			const waitTime = this.windowMs - (now - oldestTime) + 100; // +100ms buffer

			logger.info("Rate limit approaching, waiting", {
				waitTime: `${waitTime}ms`,
				queueLength: this.queue.length,
			});

			await new Promise((resolve) => setTimeout(resolve, waitTime));

			return this.wait(); // Retry after waiting
		}

		// Track this request
		this.queue.push(now);
	}

	getStatus() {
		const now = Date.now();
		const activeRequests = this.queue.filter(
			(time) => now - time < this.windowMs,
		);

		return {
			remaining: this.maxRequests - activeRequests.length,
			limit: this.maxRequests,
			percentUsed: (
				(activeRequests.length / this.maxRequests) *
				100
			).toFixed(1),
		};
	}
}
