import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Third-party scripts (e.g. affiliate / wallet UIs) often call `ethereum.request`
 * without catching "no extension" cases. Those are expected for many visitors
 * and are not actionable app bugs — drop them so they do not pollute Sentry.
 */
function collectErrorTextFragments(
	event: Sentry.Event,
	hint: Sentry.EventHint,
): string[] {
	const parts: string[] = [];

	if (event.message) {
		parts.push(event.message);
	}

	for (const ex of event.exception?.values ?? []) {
		if (ex.value) {
			parts.push(ex.value);
		}
	}

	const err = hint.originalException;
	if (err instanceof Error) {
		parts.push(err.message);
		const { cause } = err;
		if (cause instanceof Error) {
			parts.push(cause.message);
		}
	}

	return parts;
}

function isIgnorableThirdPartyWalletError(
	event: Sentry.Event,
	hint: Sentry.EventHint,
): boolean {
	const text = collectErrorTextFragments(event, hint).join(" ").toLowerCase();

	return (
		text.includes("metamask extension not found") ||
		text.includes("failed to connect to metamask")
	);
}

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	enableLogs: true,

	integrations: [
		Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
	],

	beforeSend(event, hint) {
		if (isIgnorableThirdPartyWalletError(event, hint)) {
			return null;
		}
		return event;
	},

	// Performance monitoring
	tracesSampleRate: 0.1, // 10% of transactions in production

	// Only send errors in production
	enabled: process.env.NODE_ENV === "production",
});
