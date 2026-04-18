import { getCachedMarketingFaqs } from "@marketing/lib/marketing-content-cache";
import { FaqAccordion } from "./faq-accordion";

const defaultFaqItems = [
	{
		question: "What do I actually get with my membership?",
		answer: "You get access to our private Discord community, weekly live training sessions, session replays, and our affiliate program. We add new content and training regularly — this isn't a static course, it's an active community.",
	},
	{
		question: "What kind of creators is this for?",
		answer: "LifePreneur is for entrepreneurs who are serious about the long game. The platform we focus on teaching will always be the one with the best opportunity right now — that's what being a lifetime entrepreneur means. If you're here to build something real and keep adapting, you'll fit right in.",
	},
	{
		question: "I'm a complete beginner. Is this right for me?",
		answer: "Yes. Our community includes members at every stage — from day one to multi-figure businesses. Training sessions are designed to be immediately actionable regardless of where you're starting from.",
	},
	{
		question: "Can I cancel my membership?",
		answer: "Yes, anytime — directly from your account settings. No contracts, no cancellation fees, no runaround.",
	},
	{
		question: "How do I access the community after joining?",
		answer: "After signing up you'll create your account and be walked through connecting to our private Discord server. The whole process takes less than 5 minutes.",
	},
];

export async function FaqSection() {
	const dbFaqs = await getCachedMarketingFaqs();
	const faqItems = dbFaqs ?? defaultFaqItems;

	return (
		<section id="faq" className="pt-20 pb-12 md:pt-28 md:pb-20">
			<div className="mx-auto max-w-3xl px-4 md:px-8">
				<FaqAccordion items={faqItems} />
			</div>
		</section>
	);
}
