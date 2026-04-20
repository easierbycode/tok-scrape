import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	enableLogs: true,

	integrations: [
		Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
	],

	tracesSampleRate: 0.1,

	enabled: process.env.NODE_ENV === "production",
});
