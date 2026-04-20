"use client";

import { Button } from "@ui/components/button";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import { ArrowRight, Sparkles } from "@/modules/ui/icons";

interface FinalCtaContentProps {
	badgeText: string;
	headline: string;
	description: string;
	buttonText: string;
}

export function FinalCtaContent({
	badgeText,
	headline,
	description,
	buttonText,
}: FinalCtaContentProps) {
	const { ref, isInView } = useInView();

	return (
		<div
			ref={ref}
			className={cn(
				"transition-all duration-700",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-6",
			)}
		>
			{/* Badge */}
			<div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2">
				<Sparkles className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold text-primary">
					{badgeText}
				</span>
			</div>

			{/* Heading */}
			<h2 className="mb-6 text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
				{headline.includes(" ") ? (
					<>
						{headline.split(" ").slice(0, -1).join(" ")}{" "}
						<span className="text-primary">
							{headline.split(" ").slice(-1)[0]}
						</span>
					</>
				) : (
					<span className="text-primary">{headline}</span>
				)}
			</h2>

			{/* Description */}
			<p className="mb-8 text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
				{description}
			</p>

			<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
				<Button
					size="lg"
					className="group bg-primary text-lg text-primary-foreground transition-[transform,box-shadow] hover:scale-105 hover:bg-primary/90 hover:shadow-brand-glow md:hover:shadow-brand-glow-desktop"
					asChild
				>
					<a href="#pricing">
						{buttonText}
						<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
					</a>
				</Button>
			</div>

			<div className="flex flex-col items-center gap-4 text-sm text-muted-foreground md:flex-row md:justify-center md:gap-8">
				{[
					{ text: "Instant access" },
					{ text: "Cancel anytime" },
					{ text: "Join 300+ members" },
				].map((item, index) => (
					<div key={index} className="flex items-center gap-2">
						<div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
							<svg
								className="h-3 w-3 text-primary"
								fill="currentColor"
								viewBox="0 0 20 20"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
									clipRule="evenodd"
								/>
							</svg>
						</div>
						<span>{item.text}</span>
					</div>
				))}
			</div>
		</div>
	);
}
