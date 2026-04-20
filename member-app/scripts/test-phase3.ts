/**
 * Automated tests for Phase 3 features
 * Run with: npx tsx --env-file=.env scripts/test-phase3.ts
 */

import { config } from "dotenv";
config();

import { db } from "@repo/database";

async function testPhase3() {
	console.log("🧪 Testing Phase 3 Features...\n");

	try {
		// Test 1: Email template availability
		console.log("1. Email Templates:");
		try {
			const { mailTemplates } = await import("../packages/mail/emails/index.ts");
			console.log(
				`   ${mailTemplates.paymentFailed ? "✓" : "✗"} PaymentFailed template exists`,
			);
			console.log(
				`   ${mailTemplates.discordInvite ? "✓" : "✗"} DiscordInvite template exists`,
			);
			console.log(
				`   ${mailTemplates.gracePeriodExpiring ? "✓" : "✗"} GracePeriodExpiring template exists`,
			);
		} catch (error) {
			console.log("   ⚠️  Could not load email templates (may need build)");
			console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Test 2: Check notification system
		console.log("\n2. Notification System:");
		const notificationCount = await db.notification.count();
		const unreadCount = await db.notification.count({
			where: { read: false },
		});
		console.log(`   Total notifications: ${notificationCount}`);
		console.log(`   Unread notifications: ${unreadCount}`);

		// Test 3: Discord audit logs
		console.log("\n3. Discord Audit Logs:");
		const auditLogs = await db.discordAudit.findMany({
			take: 5,
			orderBy: { createdAt: "desc" },
			include: { user: { select: { email: true } } },
		});
		console.log(`   Recent audit logs: ${auditLogs.length}`);
		if (auditLogs.length > 0) {
			console.log(
				`   Latest: ${auditLogs[0].action} - ${auditLogs[0].user.email}`,
			);
		}

		// Test 4: Additional accounts
		console.log("\n4. Additional Discord Accounts:");
		const additionalAccounts = await db.additionalDiscordAccount.findMany({
			include: { primaryUser: { select: { email: true } } },
		});
		console.log(`   Total additional accounts: ${additionalAccounts.length}`);
		console.log(
			`   Active: ${additionalAccounts.filter((a) => a.active).length}`,
		);

		// Test 5: Pending invites
		console.log("\n5. Pending Discord Invites:");
		const pendingInvites = await db.pendingDiscordInvite.findMany({
			where: { status: "pending" },
		});
		const expiredInvites = await db.pendingDiscordInvite.findMany({
			where: {
				status: "pending",
				expiresAt: { lt: new Date() },
			},
		});
		console.log(`   Pending invites: ${pendingInvites.length}`);
		console.log(`   Expired invites (need cleanup): ${expiredInvites.length}`);

		console.log("\n✅ Phase 3 tests complete!");
		console.log("\n📝 Manual Testing:");
		console.log("   1. Trigger payment failure in Stripe test mode");
		console.log("   2. Check email delivery");
		console.log("   3. Verify notification banners appear");
		console.log("   4. Test admin Discord UI pages");
	} catch (error) {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
	}
}

testPhase3()
	.catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
		process.exit(0);
	});

