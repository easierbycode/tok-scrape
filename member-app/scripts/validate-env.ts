/**
 * Validates all required environment variables
 * Run: pnpm tsx scripts/validate-env.ts
 */

const REQUIRED = [
	"DATABASE_URL",
	"DIRECT_URL",
	"STRIPE_SECRET_KEY",
	"STRIPE_WEBHOOK_SECRET",
	"NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY",
	"NEXT_PUBLIC_PRICE_ID_CREATOR_MONTHLY",
	"NEXT_PUBLIC_PRICE_ID_STREAMER_MONTHLY",
	"NEXT_PUBLIC_PRICE_ID_PARTNER_MONTHLY",
	"NEXT_PUBLIC_PRICE_ID_TEST_DAILY",
	"NEXT_PUBLIC_PRICE_ID_TEST_2DAY",
	"NEXT_PUBLIC_PRICE_ID_LIFETIME",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"RESEND_API_KEY",
	"CSRF_SECRET",
	"DISCORD_CLIENT_ID",
	"DISCORD_CLIENT_SECRET",
	"DISCORD_BOT_TOKEN",
	"DISCORD_GUILD_ID",
	"DISCORD_ACTIVE_ROLE_ID",
	"DISCORD_GRACE_PERIOD_ROLE_ID",
	"DEV_ADMIN_BYPASS",
	"SUPER_ADMIN_EMAILS",
];

function validate() {
	console.log("🔍 Validating environment...\n");
	let errors = false;

	for (const key of REQUIRED) {
		const value = process.env[key];
		if (!value) {
			console.log(`  ❌ ${key} - MISSING`);
			errors = true;
		} else {
			console.log(`  ✅ ${key}`);
		}
	}

	// Specific validations
	const csrf = process.env.CSRF_SECRET;
	if (csrf && csrf.length < 64) {
		console.log(`\n  ⚠️  CSRF_SECRET should be 64+ chars (${csrf.length})`);
		errors = true;
	}

	const stripe = process.env.STRIPE_SECRET_KEY;
	const isProd = process.env.NODE_ENV === "production";
	if (isProd && stripe?.startsWith("sk_test_")) {
		console.log("\n  ⚠️  Using test Stripe key in production!");
		errors = true;
	}

	console.log(
		"\n  Optional / legacy Stripe price IDs (legacy Pro subscribers):",
	);
	for (const key of [
		"NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY",
		"NEXT_PUBLIC_PRICE_ID_PRO_YEARLY",
	] as const) {
		const value = process.env[key];
		console.log(
			value ? `  ℹ️  ${key} is set` : `  ℹ️  ${key} — not set (optional)`,
		);
	}

	console.log("\n  Optional Discord / Message Studio:");
	for (const key of [
		"DISCORD_NOT_ONBOARDED_ROLE_ID",
		"DISCORD_MESSAGE_STUDIO_ENABLED",
	] as const) {
		const value = process.env[key];
		console.log(
			value ? `  ℹ️  ${key} is set` : `  ℹ️  ${key} — not set (optional)`,
		);
	}

	console.log(`\n${"=".repeat(50)}`);
	if (errors) {
		console.log("❌ Validation FAILED");
		process.exit(1);
	} else {
		console.log("✅ Environment valid!");
		process.exit(0);
	}
}

validate();
