/**
 * Test script for Phase 2 database models
 * Run: npx dotenv-cli -c -- tsx scripts/test-phase2-models.ts
 */

import { db } from "@repo/database";
import {
	getActiveSubscription,
	getManualOverride,
	userHasAccess,
} from "@repo/database/prisma/queries/access";

async function test() {
	console.log("🧪 Testing Phase 2 Database Models...\n");

	try {
		// Get or create a test user
		let testUser = await db.user.findFirst({
			where: { email: "test-admin@lifepreneur.com" },
		});

		if (!testUser) {
			console.log("⚠️  Test user not found, creating one...");
			testUser = await db.user.create({
				data: {
					name: "Test Admin",
					email: "test-admin@lifepreneur.com",
					emailVerified: true,
					createdAt: new Date(),
					updatedAt: new Date(),
				},
			});
		}

		const userId = testUser.id;
		console.log(`✅ Using test user: ${testUser.email} (${userId})\n`);

		// Test Notification
		console.log("📧 Testing Notification model...");
		const notification = await db.notification.create({
			data: {
				userId,
				type: "info",
				title: "Test Notification",
				message: "This is a test notification",
			},
		});
		console.log("✅ Notification created:", notification.id);

		// Test Announcement
		console.log("\n📢 Testing Announcement model...");
		const announcement = await db.announcement.create({
			data: {
				title: "Test Announcement",
				content: "This is test content for an announcement",
				type: "info",
				publishedAt: new Date(),
			},
		});
		console.log("✅ Announcement created:", announcement.id);

		// Test ContentVideo
		console.log("\n🎥 Testing ContentVideo model...");
		const video = await db.contentVideo.create({
			data: {
				title: "Test Video",
				description: "A test video description",
				category: "getting-started",
				duration: 180,
				videoUrl: "https://example.com/video",
				thumbnailUrl: "https://example.com/thumbnail",
				orderIndex: 1,
				published: true,
			},
		});
		console.log("✅ ContentVideo created:", video.id);

		// Test VideoProgress
		console.log("\n📊 Testing VideoProgress model...");
		const videoProgress = await db.videoProgress.create({
			data: {
				userId,
				videoId: video.id,
				progress: 60,
				completed: false,
			},
		});
		console.log("✅ VideoProgress created:", videoProgress.id);

		// Test AuditLog
		console.log("\n📝 Testing AuditLog model...");
		const auditLog = await db.auditLog.create({
			data: {
				adminUserId: userId,
				action: "CREATE_USER",
				targetType: "user",
				targetId: userId,
				metadata: { test: true },
			},
		});
		console.log("✅ AuditLog created:", auditLog.id);

		// Test Affiliate
		console.log("\n🤝 Testing Affiliate model...");
		const affiliate = await db.affiliate.create({
			data: {
				userId,
				rewardfulId: `test-${Date.now()}`,
				slug: `test-slug-${Date.now()}`,
				status: "active",
			},
		});
		console.log("✅ Affiliate created:", affiliate.id);

		// Test Access Helpers
		console.log("\n🔐 Testing Access Query Helpers...");
		const hasAccess = await userHasAccess(userId);
		console.log(`✅ userHasAccess: ${hasAccess}`);

		const manualOverride = await getManualOverride(userId);
		console.log(
			`✅ getManualOverride: ${manualOverride ? "Found" : "None"}`,
		);

		const activeSubscription = await getActiveSubscription(userId);
		console.log(
			`✅ getActiveSubscription: ${activeSubscription ? "Found" : "None"}`,
		);

		// Cleanup test data
		console.log("\n🧹 Cleaning up test data...");
		await db.videoProgress.delete({ where: { id: videoProgress.id } });
		await db.affiliate.delete({ where: { id: affiliate.id } });
		await db.auditLog.delete({ where: { id: auditLog.id } });
		await db.notification.delete({ where: { id: notification.id } });
		await db.announcement.delete({ where: { id: announcement.id } });
		await db.contentVideo.delete({ where: { id: video.id } });
		console.log("✅ Cleanup complete");

		console.log("\n✅ All Phase 2 models tested successfully!");
	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

test()
	.then(() => {
		console.log("\n✨ Test suite completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("❌ Fatal error:", error);
		process.exit(1);
	});
