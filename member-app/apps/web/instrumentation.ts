/**
 * Next.js Instrumentation Hook
 *
 * This file is loaded once when the Next.js server starts.
 * Used for process-level error handling on the Node.js runtime.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

const TRANSIENT_ERROR_PATTERNS = [
	"socket hang up",
	"ETIMEDOUT",
	"ECONNRESET",
	"ECONNREFUSED",
	"TLS connection",
	"EPIPE",
];

function isTransientNetworkError(message: string): boolean {
	return TRANSIENT_ERROR_PATTERNS.some((pattern) =>
		message.includes(pattern),
	);
}

export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}

	process.on("uncaughtException", (error) => {
		const msg = error?.message ?? "";

		if (isTransientNetworkError(msg)) {
			console.warn(`[transient-error] ${msg}`);
			return;
		}

		console.error("[uncaught-exception]", error);
	});

	process.on("unhandledRejection", (reason) => {
		console.error("[unhandled-rejection]", reason);
	});
}
