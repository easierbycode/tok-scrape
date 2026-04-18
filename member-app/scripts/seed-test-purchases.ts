/**
 * Creates test purchases for development and testing
 * Run: npx dotenv-cli -c -- tsx scripts/seed-test-purchases.ts
 *
 * Creates:
 * - Active subscriptions (test-newsubscriber, test-affiliate, test-admin)
 * - Grace period subscription (test-graceperiod)
 * - No subscription (test-nosubscription) for testing access denial
 */

import { db, getUserByEmail } from "@repo/database";

const TEST_PURCHASES = [
	{
		userEmail: "test-newsubscriber@lifepreneur.com",
		type: "SUBSCRIPTION" as const,
		status: "active",
		productId: "prod_test_monthly",
		customerId: "cus_test_newsubscriber",
		subscriptionId: "sub_test_newsubscriber",
		currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		trialEnd: null,
	},
	{
		userEmail: "test-affiliate@lifepreneur.com",
		type: "SUBSCRIPTION" as const,
		status: "active",
		productId: "prod_test_annual",
		customerId: "cus_test_affiliate",
		subscriptionId: "sub_test_affiliate",
		currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
		trialEnd: null,
	},
	{
		userEmail: "test-graceperiod@lifepreneur.com",
		type: "SUBSCRIPTION" as const,
		status: "grace_period",
		productId: "prod_test_monthly",
		customerId: "cus_test_graceperiod",
		subscriptionId: "sub_test_graceperiod",
		currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
		trialEnd: null,
	},
	{
		userEmail: "test-admin@lifepreneur.com",
		type: "SUBSCRIPTION" as const,
		status: "active",
		productId: "prod_test_monthly",
		customerId: "cus_test_admin",
		subscriptionId: "sub_test_admin",
		currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		trialEnd: null,
	},
	// test-nosubscription@lifepreneur.com intentionally has NO purchase (testing no access)
];

async function seedTestPurchases() {
	console.log("🌱 Seeding test purchases...");

	for (const purchaseData of TEST_PURCHASES) {
		try {
			// Get user
			const user = await getUserByEmail(purchaseData.userEmail);

			if (!user) {
				console.log(
					`⏭️  User ${purchaseData.userEmail} not found - run seed-test-users.ts first`,
				);
				continue;
			}

			// Check if purchase already exists
			const existing = await db.purchase.findFirst({
				where: {
					userId: user.id,
					subscriptionId: purchaseData.subscriptionId,
				},
			});

			if (existing) {
				console.log(
					`⏭️  Purchase for ${purchaseData.userEmail} already exists`,
				);
				continue;
			}

			// Create purchase
			await db.purchase.create({
				data: {
					userId: user.id,
					type: purchaseData.type,
					status: purchaseData.status,
					productId: purchaseData.productId,
					customerId: purchaseData.customerId,
					subscriptionId: purchaseData.subscriptionId,
					currentPeriodEnd: purchaseData.currentPeriodEnd,
					trialEnd: purchaseData.trialEnd,
					cancelAtPeriodEnd: false,
				},
			});

			console.log(
				`✅ Created ${purchaseData.status} subscription for ${purchaseData.userEmail}`,
			);
		} catch (error) {
			console.error(`❌ Failed ${purchaseData.userEmail}:`, error);
		}
	}

	console.log("\n✅ Test purchases seeded!");
	console.log("📝 Purchase breakdown:");
	console.log("  - test-newsubscriber: active subscription (monthly)");
	console.log("  - test-affiliate: active subscription (annual)");
	console.log("  - test-graceperiod: grace_period subscription");
	console.log("  - test-admin: active subscription (monthly)");
	console.log("  - test-nosubscription: NO purchase (testing access denial)");
	console.log(
		"\n🧪 Now you can test Discord integration with subscription checks!",
	);
}

seedTestPurchases()
	.then(async () => {
		await db.$disconnect();
		process.exit(0);
	})
	.catch(async (error) => {
		console.error("❌ Seed failed:", error);
		await db.$disconnect();
		process.exit(1);
	});






