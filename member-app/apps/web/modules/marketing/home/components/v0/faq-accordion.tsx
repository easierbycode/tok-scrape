"use client";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@ui/components/accordion";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";

interface FaqItem {
	question: string;
	answer: string;
}

function AnimatedFaqItem({ item, index }: { item: FaqItem; index: number }) {
	const { ref, isInView } = useInView(0.05);

	return (
		<div
			ref={ref}
			className={cn(
				"transition-all duration-500",
				isInView
					? "opacity-100 translate-x-0"
					: "opacity-0 -translate-x-3",
			)}
			style={{ transitionDelay: `${index * 60}ms` }}
		>
			<AccordionItem
				value={`faq-${index}`}
				className="border-b border-border"
			>
				<AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:text-primary hover:no-underline transition-colors">
					{item.question}
				</AccordionTrigger>
				<AccordionContent className="text-sm leading-relaxed text-muted-foreground md:text-base">
					{item.answer}
				</AccordionContent>
			</AccordionItem>
		</div>
	);
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
	const { ref: headingRef, isInView: headingInView } = useInView();

	return (
		<>
			<div
				ref={headingRef}
				className={cn(
					"mb-12 text-center transition-all duration-700",
					headingInView
						? "opacity-100 translate-y-0"
						: "opacity-0 translate-y-4",
				)}
			>
				<h2 className="mb-6 text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
					Got <span className="text-primary">Questions?</span>
				</h2>
				<p className="mx-auto max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
					Everything you need to know before joining the community.
				</p>
			</div>

			<Accordion type="single" collapsible className="w-full">
				{items.map((item, index) => (
					<AnimatedFaqItem key={index} item={item} index={index} />
				))}
			</Accordion>
		</>
	);
}
