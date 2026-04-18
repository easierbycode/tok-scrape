import { db } from "@repo/database";

/**
 * Seed initial beta features from config
 * Run this once to populate the database
 */
async function seedBetaFeatures() {
	console.log("🌱 Seeding beta features...");

	const features = [
		{
			id: "fullAffiliateDashboard",
			name: "Full Affiliate Dashboard",
			description:
				"Complete affiliate analytics with real-time Rewardful data integration",
			category: "commerce",
			addedDate: new Date("2025-01-15"),
			estimatedReleaseDate: new Date("2025-02-01"),
			status: "active",
		},
		{
			id: "enhancedVideoPlayer",
			name: "Enhanced Video Player",
			description:
				"New video player with picture-in-picture, speed controls, and progress tracking",
			category: "content",
			addedDate: new Date("2025-01-20"),
			estimatedReleaseDate: new Date("2025-02-15"),
			status: "active",
		},
	];

	for (const feature of features) {
		const existing = await db.betaFeature.findUnique({
			where: { id: feature.id },
		});

		if (existing) {
			console.log(
				`✓ Feature "${feature.name}" already exists, skipping...`,
			);
			continue;
		}

		await db.betaFeature.create({
			data: feature,
		});

		console.log(`✓ Created feature: ${feature.name}`);
	}

	console.log("✅ Beta features seeded successfully!");
}

seedBetaFeatures()
	.catch((error) => {
		console.error("❌ Error seeding beta features:", error);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});
