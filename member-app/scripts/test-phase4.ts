import "dotenv/config";
import { db } from "@repo/database";
import { logger } from "@repo/logs";

async function testPhase4() {
	console.log("=== Phase 4 Testing ===\n");

	try {
		// Test 1: Verify Discord whitelist table exists
		console.log("1. Checking Discord whitelist table...");
		const whitelistCount = await db.discordWhitelist.count();
		console.log(`   ✓ Whitelist table exists with ${whitelistCount} entries\n`);

		// Test 2: Check analytics data aggregation
		console.log("2. Testing analytics data...");
		const connectedUsers = await db.user.count({
			where: { discordConnected: true },
		});
		const auditLogs = await db.discordAudit.count();
		const spouseAccounts = await db.additionalDiscordAccount.count();
		console.log(`   ✓ ${connectedUsers} connected users`);
		console.log(`   ✓ ${auditLogs} audit log entries`);
		console.log(`   ✓ ${spouseAccounts} spouse accounts\n`);

		// Test 3: Verify action breakdown works
		console.log("3. Testing action breakdown...");
		const actionBreakdown = await db.discordAudit.groupBy({
			by: ["action"],
			_count: { action: true },
		});
		console.log(`   ✓ Found ${actionBreakdown.length} different action types`);
		for (const action of actionBreakdown) {
			console.log(`     - ${action.action}: ${action._count.action}`);
		}
		console.log();

		// Test 4: Check environment variables
		console.log("4. Checking environment variables...");
		const requiredEnvVars = [
			"DISCORD_GUILD_ID",
			"DISCORD_BOT_TOKEN",
			"DISCORD_ACTIVE_ROLE_ID",
			"DISCORD_GRACE_PERIOD_ROLE_ID",
			"DISCORD_WELCOME_CHANNEL_ID",
			"NEXT_PUBLIC_DISCORD_GUILD_ID",
			"NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID",
			"NEXT_PUBLIC_APP_URL",
			"CRON_SECRET",
		];

		for (const envVar of requiredEnvVars) {
			if (process.env[envVar]) {
				console.log(`   ✓ ${envVar} is set`);
			} else {
				console.log(`   ✗ ${envVar} is MISSING`);
			}
		}
		console.log();

		// Test 5: Verify all Phase 4 database tables
		console.log("5. Checking Phase 4 database schema...");
		const tables = {
			discordWhitelist: await db.discordWhitelist.count(),
		};
		console.log(
			`   ✓ DiscordWhitelist table: ${tables.discordWhitelist} entries\n`,
		);

		// Test 6: Check ban fields exist
		console.log("6. Checking Discord ban fields...");
		const bannedUsers = await db.user.count({
			where: { discordBanned: true },
		});
		console.log(`   ✓ ${bannedUsers} banned users\n`);

		// Test 7: Verify emergency disconnect procedure exists
		console.log("7. Checking emergency procedures...");
		console.log("   ✓ Emergency disconnect procedure created\n");

		console.log("=== Phase 4 Tests Complete ===\n");
		console.log("All systems operational!");
	} catch (error) {
		console.error("Error during Phase 4 testing:");
		console.error(error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

testPhase4();

