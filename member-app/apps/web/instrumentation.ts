/**
 * Next.js Instrumentation Hook
 *
 * This file is loaded once when the Next.js server starts.
 * Used for process-level error handling on the Node.js runtime.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") {
		return;
	}

	await import("./instrumentation.node.ts");
}
