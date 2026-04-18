"use client";

import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import type { ReactNode } from "react";
import { Star } from "@/modules/ui/icons";

interface TestimonialsHeaderProps {
	badgeText: string;
	headlineNode: ReactNode;
	subheadline: string;
}

export function TestimonialsHeader({
	badgeText,
	headlineNode,
	subheadline,
}: TestimonialsHeaderProps) {
	const { ref, isInView } = useInView();

	return (
		<div
			ref={ref}
			className={cn(
				"mb-16 text-center transition-all duration-700",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-4",
			)}
		>
			<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
				<Star className="h-4 w-4 text-primary" />
				<span className="text-sm font-semibold text-primary">
					{badgeText}
				</span>
			</div>
			<h2 className="mb-6 text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl lg:text-6xl">
				{headlineNode}
			</h2>
			<p className="mx-auto max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
				{subheadline}
			</p>
		</div>
	);
}
