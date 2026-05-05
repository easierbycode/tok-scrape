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
