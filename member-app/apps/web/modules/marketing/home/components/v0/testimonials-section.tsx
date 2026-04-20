import {
	getCachedMarketingContent,
	getCachedTestimonials,
} from "@marketing/lib/marketing-content-cache";
import type { ReactNode } from "react";
import { TestimonialsHeader } from "./testimonials-header";
import { TestimonialsStrip } from "./testimonials-strip";

const defaultBadgeText = "Success Stories";
const defaultHeadline = "Real Creators, Real Results";
const defaultHeadlineAccent = "Real Results";
const defaultSubheadline =
	"Join thousands of creators who transformed their passion into profitable businesses. Your success story starts here.";

function renderHeadline(
	headline: string,
	accent: string | null | undefined,
): ReactNode {
	const trimmedAccent = accent?.trim();
	if (trimmedAccent) {
		const idx = headline.indexOf(trimmedAccent);
		if (idx !== -1) {
			const before = headline.slice(0, idx);
			const after = headline.slice(idx + trimmedAccent.length);
			return (
				<>
					{before}
					<span className="text-primary">{trimmedAccent}</span>
					{after}
				</>
			);
		}
	}
	if (headline.includes(" ")) {
		return (
			<>
				{headline.split(" ").slice(0, -1).join(" ")}{" "}
				<span className="text-primary">
					{headline.split(" ").slice(-1)[0]}
				</span>
			</>
		);
	}
	return <span className="text-primary">{headline}</span>;
}

export async function TestimonialsSection() {
	const [testimonials, marketingContent] = await Promise.all([
		getCachedTestimonials(),
		getCachedMarketingContent(),
	]);

	const badgeText =
		marketingContent?.testimonialsBadgeText?.trim() || defaultBadgeText;
	const headline =
		marketingContent?.testimonialsHeadline?.trim() || defaultHeadline;
	const headlineAccent =
		marketingContent?.testimonialsHeadlineAccent?.trim() ||
		defaultHeadlineAccent;
	const subheadline =
		marketingContent?.testimonialsSubheadline?.trim() || defaultSubheadline;

	return (
		<section id="testimonials" className="pt-24 pb-12 md:pt-32 md:pb-20">
			<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
				<TestimonialsHeader
					badgeText={badgeText}
					headlineNode={renderHeadline(headline, headlineAccent)}
					subheadline={subheadline}
				/>

				<TestimonialsStrip testimonials={testimonials} />
			</div>
		</section>
	);
}
