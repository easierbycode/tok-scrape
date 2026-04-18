import { db } from "../client";

/**
 * Seed testimonials from existing hardcoded data
 * Run this after migration: npx tsx packages/database/prisma/seeds/testimonials-seed.ts
 *
 * Note: This creates testimonials with placeholder avatar paths.
 * You'll need to upload actual images via the admin dashboard and update the avatar paths.
 */
async function seedTestimonials() {
	console.log("🌱 Seeding testimonials...");

	const testimonials = [
		{
			name: "Sarah Chen",
			role: "Content Creator",
			avatar: "placeholder-sarah-chen.png", // Placeholder - upload real image via admin
			rating: 5,
			content: "[Beta testimonial content to be provided]",
			stats: "$15K/mo",
			order: 0,
			published: true,
		},
		{
			name: "Marcus Johnson",
			role: "TikTok Shop Seller",
			avatar: "placeholder-marcus-johnson.png", // Placeholder - upload real image via admin
			rating: 5,
			content: "[Beta testimonial content to be provided]",
			stats: "$8K/mo",
			order: 1,
			published: true,
		},
		{
			name: "Emily Rodriguez",
			role: "E-commerce Entrepreneur",
			avatar: "placeholder-emily-rodriguez.png", // Placeholder - upload real image via admin
			rating: 5,
			content: "[Beta testimonial content to be provided]",
			stats: "$12K/mo",
			order: 2,
			published: true,
		},
	];

	for (const testimonial of testimonials) {
		const existing = await db.testimonial.findFirst({
			where: { name: testimonial.name },
		});

		if (!existing) {
			await db.testimonial.create({
				data: testimonial,
			});
			console.log(`✅ Created testimonial: ${testimonial.name}`);
		} else {
			console.log(`⏭️  Skipped existing testimonial: ${testimonial.name}`);
		}
	}

	console.log("✨ Testimonials seeding complete!");
}

seedTestimonials()
	.catch((e) => {
		console.error("❌ Error seeding testimonials:", e);
		process.exit(1);
	})
	.finally(async () => {
		await db.$disconnect();
	});






