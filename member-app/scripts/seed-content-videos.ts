/**
 * Seed content videos for the content library
 * Run: npx dotenv-cli -c -e .env.local -- tsx scripts/seed-content-videos.ts
 */

import { db } from "@repo/database";

const CONTENT_VIDEOS = [
	// Getting Started (4 videos)
	{
		title: "TikTok Shop Setup - Complete Guide",
		description:
			"Learn how to set up your TikTok Shop account from scratch, including account verification, product listing, and initial configuration.",
		category: "getting-started",
		duration: 600, // 10 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/1a1a2e/e94560?text=TikTok+Shop+Setup",
		orderIndex: 1,
		published: true,
	},
	{
		title: "First Product Listing Made Easy",
		description:
			"Step-by-step guide to listing your first product on TikTok Shop, including product photos, descriptions, and pricing strategies.",
		category: "getting-started",
		duration: 480, // 8 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/16213e/0f3460?text=First+Product",
		orderIndex: 2,
		published: true,
	},
	{
		title: "Understanding TikTok Shop Analytics",
		description:
			"Navigate your TikTok Shop dashboard and understand key metrics that matter for your business growth.",
		category: "getting-started",
		duration: 540, // 9 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/0f3460/e94560?text=Shop+Analytics",
		orderIndex: 3,
		published: true,
	},
	{
		title: "Payment Setup & Payouts",
		description:
			"Configure your payment methods, understand payout schedules, and ensure smooth financial operations.",
		category: "getting-started",
		duration: 420, // 7 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/533483/e94560?text=Payment+Setup",
		orderIndex: 4,
		published: true,
	},
	// Advanced Strategies (4 videos)
	{
		title: "Finding Winning Products in 2024",
		description:
			"Advanced product research strategies, trend analysis, and tools to identify high-demand products before they go viral.",
		category: "advanced",
		duration: 900, // 15 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/e94560/ffffff?text=Winning+Products",
		orderIndex: 1,
		published: true,
	},
	{
		title: "Creating Viral TikTok Content",
		description:
			"Content creation framework specifically designed for TikTok Shop, including hooks, storytelling, and conversion optimization.",
		category: "advanced",
		duration: 720, // 12 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/ff6b6b/ffffff?text=Viral+Content",
		orderIndex: 2,
		published: true,
	},
	{
		title: "TikTok Shop Ad Strategies",
		description:
			"Master paid advertising on TikTok Shop, including campaign setup, targeting, budget optimization, and ROI measurement.",
		category: "advanced",
		duration: 840, // 14 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/4ecdc4/ffffff?text=Ad+Strategies",
		orderIndex: 3,
		published: true,
	},
	{
		title: "Scaling to $10K/Month",
		description:
			"Growth strategies for established shops, including inventory management, fulfillment scaling, and team building.",
		category: "advanced",
		duration: 960, // 16 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/45b7d1/ffffff?text=Scaling+10K",
		orderIndex: 4,
		published: true,
	},
	// Case Studies (3 videos)
	{
		title: "From Zero to $5K: A Real Success Story",
		description:
			"Follow one seller's journey from first listing to $5K monthly revenue, including challenges, pivots, and key decisions.",
		category: "case-studies",
		duration: 1200, // 20 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/96ceb4/ffffff?text=Zero+to+5K",
		orderIndex: 1,
		published: true,
	},
	{
		title: "Niche Product Domination Strategy",
		description:
			"How one seller captured 60% market share in a specific niche using content strategy and community building.",
		category: "case-studies",
		duration: 1080, // 18 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/ffeaa7/1a1a2e?text=Niche+Strategy",
		orderIndex: 2,
		published: true,
	},
	{
		title: "International Expansion Case Study",
		description:
			"Learn how a US-based seller successfully expanded to multiple international markets on TikTok Shop.",
		category: "case-studies",
		duration: 1320, // 22 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/dfe6e9/1a1a2e?text=Global+Expansion",
		orderIndex: 3,
		published: true,
	},
	// Tools & Resources (4 videos)
	{
		title: "Essential Tools for TikTok Shop Sellers",
		description:
			"Overview of must-have tools for product research, inventory management, analytics, and automation.",
		category: "tools",
		duration: 780, // 13 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/6c5ce7/ffffff?text=Essential+Tools",
		orderIndex: 1,
		published: true,
	},
	{
		title: "Product Research Tools Deep Dive",
		description:
			"Detailed walkthrough of top product research tools, including AliExpress, Google Trends, and TikTok analytics.",
		category: "tools",
		duration: 900, // 15 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/a29bfe/ffffff?text=Research+Tools",
		orderIndex: 2,
		published: true,
	},
	{
		title: "Automation & Workflow Optimization",
		description:
			"Streamline your operations with automation tools, workflow templates, and time-saving strategies.",
		category: "tools",
		duration: 660, // 11 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/fd79a8/ffffff?text=Automation",
		orderIndex: 3,
		published: true,
	},
	{
		title: "Analytics & Reporting Setup",
		description:
			"Set up comprehensive analytics dashboards, track KPIs, and create automated reports for data-driven decisions.",
		category: "tools",
		duration: 720, // 12 minutes
		videoUrl: "#",
		thumbnailUrl:
			"https://placehold.co/640x360/00b894/ffffff?text=Analytics+Setup",
		orderIndex: 4,
		published: true,
	},
];

async function seedContentVideos() {
	console.log("Starting content video seeding...");

	try {
		// Check if videos already exist
		const existingCount = await db.contentVideo.count();
		if (existingCount > 0) {
			console.log(
				`Found ${existingCount} existing videos. Skipping seed to avoid duplicates.`,
			);
			console.log("To re-seed, delete existing videos first.");
			return;
		}

		// Create videos
		for (const video of CONTENT_VIDEOS) {
			await db.contentVideo.create({
				data: video,
			});
			console.log(`✓ Created: ${video.title}`);
		}

		console.log(
			`\n✅ Successfully seeded ${CONTENT_VIDEOS.length} content videos!`,
		);
	} catch (error) {
		console.error("Error seeding content videos:", error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

seedContentVideos();
