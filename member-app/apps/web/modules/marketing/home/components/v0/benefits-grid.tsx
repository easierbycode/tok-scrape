"use client";

import { Card } from "@ui/components/card";
import { useCardTilt } from "@ui/hooks/use-card-tilt";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import {
	DollarSign,
	GraduationCap,
	Heart,
	type LucideIcon,
	Sparkles,
	Star,
	Users,
} from "@/modules/ui/icons";

const ICON_MAP: Record<string, LucideIcon> = {
	GraduationCap,
	Users,
	DollarSign,
	Star,
	Heart,
	Sparkles,
};

interface Benefit {
	icon: string;
	heading: string;
	bullets: string[];
}

interface BenefitsGridProps {
	benefits: Benefit[];
	headline: string;
}

function BenefitCard({ benefit, index }: { benefit: Benefit; index: number }) {
	const { ref: inViewRef, isInView } = useInView();
	const { ref: tiltRef, style: tiltStyle } = useCardTilt(5);
	const IconComp = ICON_MAP[benefit.icon] || GraduationCap;

	return (
		<div
			ref={inViewRef}
			className={cn(
				"transition-all duration-700 h-full",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-8",
			)}
			style={{ transitionDelay: `${index * 120}ms` }}
		>
			<Card
				ref={tiltRef}
				style={tiltStyle}
				className="h-full border-border bg-card p-6 shadow-flat transition-shadow duration-300 hover:shadow-elevated md:hover:shadow-elevated-desktop"
			>
				<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<IconComp className="h-6 w-6 text-primary" />
				</div>
				<h3 className="mb-4 text-xl font-bold text-foreground">
					{benefit.heading}
				</h3>
				<ul className="space-y-2">
					{benefit.bullets.map((bullet, i) => (
						<li
							key={i}
							className="flex items-start gap-2 text-sm text-muted-foreground"
						>
							<span className="mt-1 text-primary">{"•"}</span>
							<span>{bullet}</span>
						</li>
					))}
				</ul>
			</Card>
		</div>
	);
}

export function BenefitsGrid({ benefits, headline }: BenefitsGridProps) {
	const { ref: headingRef, isInView: headingInView } = useInView();

	return (
		<>
			<div
				ref={headingRef}
				className={cn(
					"mb-16 text-center transition-all duration-700",
					headingInView
						? "opacity-100 translate-y-0"
						: "opacity-0 translate-y-4",
				)}
			>
				<h2 className="mb-6 text-balance font-serif text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
					{headline}
				</h2>
			</div>

			<div className="grid gap-8 md:grid-cols-3">
				{benefits.map((benefit, index) => (
					<BenefitCard key={index} benefit={benefit} index={index} />
				))}
			</div>
		</>
	);
}
