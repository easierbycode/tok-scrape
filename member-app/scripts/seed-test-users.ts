/**
 * Creates test users for development and impersonation testing
 * Run: pnpm tsx scripts/seed-test-users.ts
 */

import { auth } from "@repo/auth";
import { createUser, createUserAccount, getUserByEmail } from "@repo/database";

const TEST_USERS = [
	{
		email: "test-newsubscriber@lifepreneur.com",
		name: "Test New Subscriber",
		role: null as const,
		onboardingComplete: false,
		emailVerified: true,
	},
	{
		email: "test-affiliate@lifepreneur.com",
		name: "Test Affiliate",
		role: null as const,
		onboardingComplete: true,
		emailVerified: true,
	},
	{
		email: "test-nosubscription@lifepreneur.com",
		name: "Test No Subscription",
		role: null as const,
		onboardingComplete: true,
		emailVerified: true,
	},
	{
		email: "test-graceperiod@lifepreneur.com",
		name: "Test Grace Period",
		role: null as const,
		onboardingComplete: true,
		emailVerified: true,
	},
	{
		email: "test-admin@lifepreneur.com",
		name: "Test Admin",
		role: "admin" as const,
		onboardingComplete: true,
		emailVerified: true,
	},
];

const TEST_PASSWORD = "test-password-123";

async function seedTestUsers() {
	console.log("🌱 Seeding test users...");

	// Get Better-Auth context for password hashing
	const authContext = await auth.$context;

	// Hash password once
	const hashedPassword = await authContext.password.hash(TEST_PASSWORD);

	for (const userData of TEST_USERS) {
		try {
			// Check if user exists
			const existing = await getUserByEmail(userData.email);

			if (existing) {
				console.log(`⏭️  ${userData.email} already exists`);
				continue;
			}

			// Create user
			const user = await createUser({
				email: userData.email,
				name: userData.name,
				role: userData.role ?? "user",
				onboardingComplete: userData.onboardingComplete,
				emailVerified: userData.emailVerified,
			});

			// Create account (Better-Auth requirement)
			await createUserAccount({
				userId: user.id,
				accountId: user.id,
				providerId: "credential",
				hashedPassword,
			});

			console.log(`✅ Created ${userData.email}`);
		} catch (error) {
			console.error(`❌ Failed ${userData.email}:`, error);
		}
	}

	console.log("\n✅ Test users seeded!");
	console.log("📝 All users use password:", TEST_PASSWORD);
}

seedTestUsers()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error("❌ Seed failed:", error);
		process.exit(1);
	});
