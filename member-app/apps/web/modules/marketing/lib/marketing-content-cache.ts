import { db } from "@repo/database";
import { unstable_cache } from "next/cache";
import { cache } from "react";

export const MARKETING_CONTENT_TAG = "marketing-content";
export const PRICING_PLANS_TAG = "pricing-plans";
export const TESTIMONIALS_TAG = "testimonials";

// Each function is wrapped with React's cache() for per-request deduplication,
// so calling the same function multiple times in one render hits the DB only once.
export const getCachedMarketingContent = cache(
	unstable_cache(
		async () => {
			try {
				return await db.marketingContent.findUnique({
					where: { id: "singleton" },
				});
			} catch {
				return null;
			}
		},
		["marketing-content-singleton"],
		{ tags: [MARKETING_CONTENT_TAG], revalidate: 300 },
	),
);

export const getCachedPricingPlans = cache(
	unstable_cache(
		async () => {
			try {
				return await db.marketingPricingPlan.findMany({
					where: { published: true },
					orderBy: { order: "asc" },
				});
			} catch {
				return [];
			}
		},
		["marketing-pricing-plans-published"],
		{ tags: [PRICING_PLANS_TAG], revalidate: 300 },
	),
);

export const getCachedMarketingFaqs = cache(
	unstable_cache(
		async () => {
			try {
				const faqs = await db.marketingFaq.findMany({
					where: { published: true },
					orderBy: { order: "asc" },
					select: { question: true, answer: true },
				});
				return faqs.length > 0 ? faqs : null;
			} catch {
				return null;
			}
		},
		["marketing-faqs-published"],
		{ tags: [MARKETING_CONTENT_TAG], revalidate: 300 },
	),
);

export const getCachedMarketingBenefits = cache(
	unstable_cache(
		async () => {
			try {
				const benefits = await db.marketingBenefit.findMany({
					where: { published: true },
					orderBy: { order: "asc" },
				});
				return benefits.length > 0 ? benefits : null;
			} catch {
				return null;
			}
		},
		["marketing-benefits-published"],
		{ tags: [MARKETING_CONTENT_TAG], revalidate: 300 },
	),
);

export const getCachedTestimonials = cache(
	unstable_cache(
		async () => {
			try {
				return await db.testimonial.findMany({
					where: { published: true },
					orderBy: { order: "asc" },
					select: {
						id: true,
						name: true,
						role: true,
						content: true,
						rating: true,
						stats: true,
						avatar: true,
					},
				});
			} catch {
				return [];
			}
		},
		["testimonials-published"],
		{ tags: [TESTIMONIALS_TAG], revalidate: 300 },
	),
);
