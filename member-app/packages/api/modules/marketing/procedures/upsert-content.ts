import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const upsertMarketingContent = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/content/upsert",
		tags: ["Marketing"],
		summary: "Update marketing content",
		description: "Create or update marketing content (admin only)",
	})
	.input(
		z.object({
			heroHeadline: z.string().optional(),
			heroHeadlineAccent: z.string().optional(),
			heroSubheadline: z.string().optional(),
			heroCtaText: z.string().optional(),
			heroBadgeText: z.string().optional(),
			heroVideoUrl: z.string().optional(),
			heroThumbnailUrl: z.string().optional(),
			testimonialsBadgeText: z.string().optional(),
			testimonialsHeadline: z.string().optional(),
			testimonialsHeadlineAccent: z.string().optional(),
			testimonialsSubheadline: z.string().optional(),
			benefitsHeadline: z.string().optional(),
			pricingBadgeText: z.string().optional(),
			pricingHeadline: z.string().optional(),
			pricingSubheadline: z.string().optional(),
			ctaBadgeText: z.string().optional(),
			ctaHeadline: z.string().optional(),
			ctaDescription: z.string().optional(),
			ctaButtonText: z.string().optional(),
			stickyCtaTitle: z.string().optional(),
			stickyCtaSubtitle: z.string().optional(),
			stickyCtaButtonText: z.string().optional(),
			stickyCtaMobileText: z.string().optional(),
			stickyCtaLink: z.string().optional(),
			seoTitle: z.string().optional(),
			seoDescription: z.string().optional(),
			seoOgImage: z.string().optional(),
			affiliateLinkComingSoon: z.boolean().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		return await db.marketingContent.upsert({
			where: { id: "singleton" },
			create: {
				id: "singleton",
				...input,
				updatedBy: context.user.id,
			},
			update: {
				...input,
				updatedBy: context.user.id,
			},
		});
	});
