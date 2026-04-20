/**
 * Automated tests for Phase 1 features
 * Run with: npx tsx scripts/test-phase1.ts
 */

// Load environment variables from .env FIRST
import { config } from "dotenv";
config();

// Then import database
import { db } from "@repo/database";

async function testPhase1() {
	console.log("🧪 Testing Phase 1 Features...\n");

	try {
		// Test 1: Check schema changes
		console.log("1. Checking database schema...");
		const user = await db.user.findFirst();

		if (!user) {
			console.log("   ⚠️  No users found in database");
		} else {
			const hasStripeEmail = "stripeEmail" in user;
			const hasNotificationEmail = "notificationEmail" in user;
			console.log(
				`   ${hasStripeEmail ? "✓" : "✗"} stripeEmail field exists`,
			);
			console.log(
				`   ${hasNotificationEmail ? "✓" : "✗"} notificationEmail field exists`,
			);
		}

		// Test 2: Check DiscordAudit table
		const auditCount = await db.discordAudit.count();
		console.log(`   ✓ DiscordAudit table exists, entries: ${auditCount}`);

		// Test 3: Check for users with Discord connected
		console.log("\n2. Discord Statistics:");
		const totalUsers = await db.user.count();
		const discordUsers = await db.user.count({
			where: { discordConnected: true },
		});
		const disconnectedWithHistory = await db.user.count({
			where: {
				discordConnected: false,
				discordId: { not: null },
			},
		});

		console.log(`   Total users: ${totalUsers}`);
		console.log(`   Currently connected: ${discordUsers}`);
		console.log(
			`   Disconnected (with history): ${disconnectedWithHistory}`,
		);

		// Test 4: Check recent audit logs
		const recentAudits = await db.discordAudit.findMany({
			take: 10,
			orderBy: { createdAt: "desc" },
			include: {
				user: {
					select: {
						name: true,
						email: true,
						discordConnected: true,
					},
				},
			},
		});

		console.log("\n3. Recent Discord Audit Logs:");
		if (recentAudits.length === 0) {
			console.log("   No audit logs yet");
		} else {
			recentAudits.forEach((log, index) => {
				const date = log.createdAt.toLocaleString();
				const connected = log.user.discordConnected ? "🟢" : "🔴";
				console.log(
					`   ${index + 1}. [${date}] ${connected} ${log.action.toUpperCase()}`,
				);
				console.log(`      User: ${log.user.name} (${log.user.email})`);
				console.log(
					`      Discord: ${log.discordUsername || "unknown"} (${log.discordId})`,
				);
				console.log(`      Reason: ${log.reason || "none specified"}`);
				if (log.metadata) {
					console.log(`      Metadata: ${JSON.stringify(log.metadata)}`);
				}
				console.log("");
			});
		}

		// Test 5: Check for multi-account issues
		console.log("4. Multi-Account Analysis:");
		const duplicateDiscordIds = await db.$queryRaw<
			Array<{ discord_id: string; count: bigint }>
		>`
      SELECT discord_id, COUNT(*) as count
      FROM "user"
      WHERE discord_id IS NOT NULL
      GROUP BY discord_id
      HAVING COUNT(*) > 1
    `;

		if (Array.isArray(duplicateDiscordIds) && duplicateDiscordIds.length > 0) {
			console.log(
				`   ⚠️  Found ${duplicateDiscordIds.length} Discord IDs connected to multiple users:`,
			);
			duplicateDiscordIds.forEach((row) => {
				console.log(
					`      Discord ID ${row.discord_id}: ${row.count} users`,
				);
			});
		} else {
			console.log("   ✓ No duplicate Discord connections found");
		}

		// Test 6: Check email field population
		console.log("\n5. Email Fields Analysis:");
		const usersWithStripeEmail = await db.user.count({
			where: { stripeEmail: { not: null } },
		});
		const usersWithNotificationEmail = await db.user.count({
			where: { notificationEmail: { not: null } },
		});

		console.log(
			`   Users with stripeEmail: ${usersWithStripeEmail}/${totalUsers}`,
		);
		console.log(
			`   Users with notificationEmail: ${usersWithNotificationEmail}/${totalUsers}`,
		);

		if (totalUsers > 0) {
			const stripeEmailPercent = Math.round(
				(usersWithStripeEmail / totalUsers) * 100,
			);
			const notificationEmailPercent = Math.round(
				(usersWithNotificationEmail / totalUsers) * 100,
			);
			console.log(
				`   Coverage: ${stripeEmailPercent}% / ${notificationEmailPercent}%`,
			);
		}

		// Test 7: Check for users with multiple active subscriptions
		console.log("\n6. Subscription Integrity:");
		
		// Get all active subscriptions grouped by user
		const activeSubscriptions = await db.purchase.groupBy({
			by: ["userId"],
			where: {
				type: "SUBSCRIPTION",
				status: { in: ["active", "trialing", "grace_period"] },
				userId: { not: null },
			},
			_count: {
				userId: true,
			},
			having: {
				userId: {
					_count: {
						gt: 1,
					},
				},
			},
		});

		if (activeSubscriptions.length > 0) {
			console.log(
				`   ⚠️  Found ${activeSubscriptions.length} users with multiple active subscriptions`,
			);
			for (const row of activeSubscriptions) {
				if (row.userId) {
					const user = await db.user.findUnique({
						where: { id: row.userId },
						select: { name: true, email: true },
					});
					console.log(
						`      ${user?.name} (${user?.email}): ${row._count.userId} subscriptions`,
					);
				}
			}
		} else {
			console.log("   ✓ No users with multiple active subscriptions");
		}

		console.log("\n✅ Phase 1 schema and data tests complete!");
		console.log("\n📝 Next Steps:");
		console.log("   1. Test grace period recovery (see manual testing guide)");
		console.log("   2. Test voluntary Discord leave");
		console.log("   3. Test multi-account prevention");
		console.log("   4. Test auto-cancel subscriptions");
	} catch (error) {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
	}
}

testPhase1()
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
		process.exit(0);
	});

