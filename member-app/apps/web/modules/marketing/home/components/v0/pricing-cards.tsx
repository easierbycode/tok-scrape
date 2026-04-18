"use client";

import { logger } from "@repo/logs";
import { usePrefersReducedMotion } from "@shared/hooks/use-prefers-reduced-motion";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { useCardTilt } from "@ui/hooks/use-card-tilt";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "@/modules/ui/icons";
import {
	Check,
	Crown,
	DollarSign,
	Flame,
	Rocket,
	Shield,
	Sparkles,
	Star,
	Trophy,
	Zap,
} from "@/modules/ui/icons";

const PRICING_ICON_MAP: Record<string, LucideIcon> = {
	Zap,
	Star,
	Crown,
	Sparkles,
	Flame,
	Trophy,
	Shield,
	Rocket,
	DollarSign,
};

export interface PricingPlan {
	name: string;
	price: string;
	period: string;
	/** Kept for admin/CMS; not shown on the marketing card */
	description: string;
	/** Short persona line under the plan name */
	subtitle?: string | null;
	features: string[];
	ctaText: string;
	popular: boolean;
	badge: string | null;
	checkoutUrl: string;
	stripePriceId?: string | null;
	planType?: string;
	icon: string | null;
	allowPromoCodes?: boolean;
	inheritsFrom?: string | null;
	compareAtPrice?: string | null;
	trustText?: string | null;
}

interface PricingCardsProps {
	plans: PricingPlan[];
	badgeText: string;
	headline: string;
	subheadline: string;
}

function usePricingCarouselViewport() {
	const [matches, setMatches] = useState<boolean | undefined>(undefined);

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 767px)");
		const onChange = () => setMatches(mq.matches);
		mq.addEventListener("change", onChange);
		setMatches(mq.matches);
		return () => mq.removeEventListener("change", onChange);
	}, []);

	return matches === true;
}

function orderPlansForCarousel(plans: PricingPlan[]) {
	const popularIdx = plans.findIndex((p) => p.popular);
	if (popularIdx <= 0) {
		return plans;
	}
	return [plans[popularIdx], ...plans.filter((_, i) => i !== popularIdx)];
}

function PriceDisplay({ price }: { price: string }) {
	return (
		<span className="text-5xl font-bold tabular-nums text-foreground">
			{price}
		</span>
	);
}

interface PricingPlanCardSurfaceProps {
	plan: PricingPlan;
	index: number;
	loadingIndex: number | null;
	onPlanClick: (plan: PricingPlan, index: number) => void;
	isPreview?: boolean;
	enableTilt?: boolean;
}

function PricingPlanCardSurface({
	plan,
	index,
	loadingIndex,
	onPlanClick,
	isPreview = false,
	enableTilt = true,
}: PricingPlanCardSurfaceProps) {
	const FallbackIcon = plan.popular ? Crown : Zap;
	const IconComp = (plan.icon && PRICING_ICON_MAP[plan.icon]) || FallbackIcon;
	const { ref: tiltRef, style: tiltStyle } = useCardTilt(6);

	return (
		<div className="relative pt-5">
			{plan.popular ? (
				<div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2">
					<div className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary px-3 py-1 shadow-raised">
						<Star className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
						<span className="text-[0.65rem] font-bold uppercase tracking-wider text-primary-foreground">
							Most Popular
						</span>
					</div>
				</div>
			) : null}
			<Card
				ref={enableTilt ? tiltRef : undefined}
				style={enableTilt ? tiltStyle : undefined}
				className={cn(
					"relative overflow-hidden border transition-shadow duration-300",
					plan.popular
						? "border-primary bg-card/80 shadow-none shadow-brand-glow backdrop-blur ring-2 ring-primary ring-offset-2 ring-offset-background md:shadow-brand-glow-desktop lg:-my-2 lg:scale-[1.04]"
						: "border-border bg-card shadow-none shadow-flat hover:shadow-elevated md:hover:shadow-elevated-desktop",
				)}
			>
				{plan.popular ? (
					<div
						className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-primary/15 to-transparent"
						aria-hidden
					/>
				) : null}
				<div className="relative p-6 md:p-8">
					<div className="mb-6 flex gap-4">
						<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 shadow-inset-subtle">
							<IconComp className="h-7 w-7 text-primary" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<h3 className="text-2xl font-bold text-foreground">
									{plan.name || "Plan name"}
								</h3>
								{!plan.popular && plan.badge ? (
									<span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
										{plan.badge}
									</span>
								) : null}
							</div>
							{plan.subtitle ? (
								<p className="mt-1 text-sm text-muted-foreground">
									{plan.subtitle}
								</p>
							) : null}
						</div>
					</div>

					<div className="mb-2 flex flex-wrap items-baseline gap-2">
						{plan.compareAtPrice ? (
							<span className="text-xl font-medium text-muted-foreground line-through">
								{plan.compareAtPrice}
							</span>
						) : null}
						<PriceDisplay price={plan.price || "$—"} />
						<span className="text-muted-foreground">
							{plan.period}
						</span>
					</div>
					{plan.trustText ? (
						<p className="mb-6 text-center text-xs text-muted-foreground md:text-left">
							{plan.trustText}
						</p>
					) : (
						<div className="mb-6" />
					)}

					<ul className="mb-8 space-y-3">
						{plan.inheritsFrom ? (
							<li className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Everything in {plan.inheritsFrom}, plus
							</li>
						) : null}
						{plan.features.map((feature, featureIndex) => (
							<li
								key={featureIndex}
								className="group flex items-start gap-3"
							>
								<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
									<Check className="h-3 w-3 text-primary" />
								</div>
								<span className="text-sm leading-relaxed text-muted-foreground">
									{feature}
								</span>
							</li>
						))}
					</ul>

					{isPreview ? (
						<Button
							type="button"
							className={cn(
								"w-full transition-[background-color,border-color,color]",
								plan.popular
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-2 border-primary/60 bg-card text-card-foreground hover:border-primary hover:bg-muted",
							)}
							variant={plan.popular ? "primary" : "outline"}
							size="lg"
							disabled
						>
							{plan.ctaText}
						</Button>
					) : (
						<Button
							type="button"
							onClick={() => void onPlanClick(plan, index)}
							disabled={loadingIndex === index}
							className={cn(
								"w-full transition-[background-color,border-color,color]",
								plan.popular
									? "bg-primary text-primary-foreground hover:bg-primary/90"
									: "border-2 border-primary/60 bg-card text-card-foreground hover:border-primary hover:bg-muted",
							)}
							variant={plan.popular ? "primary" : "outline"}
							size="lg"
							loading={loadingIndex === index}
						>
							{loadingIndex === index
								? "Loading..."
								: plan.ctaText}
						</Button>
					)}
				</div>
			</Card>
		</div>
	);
}

function PricingPlanCardWithMotion({
	plan,
	index,
	loadingIndex,
	onPlanClick,
	enableStagger,
	enableTilt,
	isPreview = false,
}: {
	plan: PricingPlan;
	index: number;
	loadingIndex: number | null;
	onPlanClick: (plan: PricingPlan, index: number) => void;
	enableStagger: boolean;
	enableTilt: boolean;
	isPreview?: boolean;
}) {
	const { ref: inViewRef, isInView } = useInView(0.1);

	return (
		<div
			ref={inViewRef}
			className={cn(
				enableStagger && "transition-all duration-700",
				enableStagger &&
					(isInView
						? "translate-y-0 opacity-100"
						: "translate-y-8 opacity-0"),
			)}
			style={
				enableStagger
					? { transitionDelay: `${index * 120}ms` }
					: undefined
			}
		>
			<PricingPlanCardSurface
				plan={plan}
				index={index}
				loadingIndex={loadingIndex}
				onPlanClick={onPlanClick}
				isPreview={isPreview}
				enableTilt={enableTilt}
			/>
		</div>
	);
}

function MobilePricingCarousel({
	plans,
	orderedPlans,
	loadingIndex,
	onPlanClick,
	prefersReducedMotion,
}: {
	plans: PricingPlan[];
	orderedPlans: PricingPlan[];
	loadingIndex: number | null;
	onPlanClick: (plan: PricingPlan, index: number) => void;
	prefersReducedMotion: boolean;
}) {
	const [emblaRef, emblaApi] = useEmblaCarousel({
		align: "center",
		containScroll: "trimSnaps",
		loop: false,
		watchDrag: !prefersReducedMotion,
	});
	const [selectedIndex, setSelectedIndex] = useState(0);

	const indexInOriginal = useCallback(
		(plan: PricingPlan) => plans.indexOf(plan),
		[plans],
	);

	useEffect(() => {
		if (!emblaApi) {
			return;
		}
		setSelectedIndex(emblaApi.selectedScrollSnap());
		const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
		emblaApi.on("select", onSelect);
		return () => {
			emblaApi.off("select", onSelect);
		};
	}, [emblaApi]);

	return (
		<section
			className="w-full"
			aria-roledescription="carousel"
			aria-label="Pricing plans"
		>
			<div className="overflow-hidden" ref={emblaRef}>
				<div className="flex touch-pan-y items-stretch gap-3">
					{orderedPlans.map((plan) => {
						const originalIndex = indexInOriginal(plan);
						return (
							<div
								className="min-w-0 shrink-0 basis-[88%] pl-0 first:pl-1"
								key={`${plan.name}-${originalIndex}`}
							>
								<PricingPlanCardWithMotion
									plan={plan}
									index={originalIndex}
									loadingIndex={loadingIndex}
									onPlanClick={onPlanClick}
									enableStagger={false}
									enableTilt={false}
								/>
							</div>
						);
					})}
				</div>
			</div>
			<div className="mt-4 flex justify-center gap-2">
				{orderedPlans.map((plan, i) => (
					<button
						key={`dot-${plan.name}-${i}`}
						type="button"
						aria-current={selectedIndex === i ? "true" : undefined}
						aria-label={`Show ${plan.name}`}
						className={cn(
							"h-2.5 w-2.5 rounded-full transition-colors",
							selectedIndex === i
								? "bg-primary"
								: "bg-muted-foreground/40 hover:bg-muted-foreground/70",
						)}
						onClick={() => emblaApi?.scrollTo(i)}
					/>
				))}
			</div>
		</section>
	);
}

/** Live preview for admin marketing dialog — static price, no checkout */
export function PricingCardPreview({ plan }: { plan: PricingPlan }) {
	return (
		<div className="w-full max-w-[320px]">
			<PricingPlanCardWithMotion
				plan={plan}
				index={0}
				loadingIndex={null}
				onPlanClick={() => {}}
				enableStagger={false}
				enableTilt={false}
				isPreview
			/>
		</div>
	);
}

export function PricingCards({
	plans,
	badgeText,
	headline,
	subheadline,
}: PricingCardsProps) {
	const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
	const isCarouselViewport = usePricingCarouselViewport();
	const prefersReducedMotion = usePrefersReducedMotion();

	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const handlePlanClick = async (plan: PricingPlan, index: number) => {
		if (plan.stripePriceId) {
			setLoadingIndex(index);
			try {
				const { checkoutLink } =
					await createCheckoutLinkMutation.mutateAsync({
						type:
							plan.planType === "one-time"
								? "one-time"
								: "subscription",
						productId: plan.stripePriceId,
						redirectUrl: `${window.location.origin}/app`,
						allowPromoCodes: plan.allowPromoCodes ?? false,
					});
				window.location.href = checkoutLink;
			} catch (error) {
				logger.error("Failed to create checkout link", { error });
				window.location.href = plan.checkoutUrl;
			} finally {
				setLoadingIndex(null);
			}
		} else {
			window.location.href = plan.checkoutUrl;
		}
	};

	const orderedForCarousel = useMemo(
		() => orderPlansForCarousel(plans),
		[plans],
	);

	const gridClass =
		plans.length === 1
			? "mx-auto max-w-lg md:grid-cols-1"
			: plans.length === 2
				? "mx-auto max-w-4xl md:grid-cols-2"
				: plans.length === 3
					? "md:grid-cols-2 lg:grid-cols-3"
					: "gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-4";

	return (
		<>
			<div className="mb-16 animate-fade-in-up text-center">
				<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5">
					<Crown className="h-4 w-4 text-primary" />
					<span className="text-sm font-semibold text-primary">
						{badgeText}
					</span>
				</div>
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
				<p className="mx-auto max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
					{subheadline}
				</p>
			</div>

			{isCarouselViewport ? (
				<MobilePricingCarousel
					plans={plans}
					orderedPlans={orderedForCarousel}
					loadingIndex={loadingIndex}
					onPlanClick={handlePlanClick}
					prefersReducedMotion={prefersReducedMotion}
				/>
			) : (
				<section
					className={cn("grid gap-8", gridClass)}
					aria-label="Pricing plans"
					onMouseLeave={() => setHoveredIndex(null)}
				>
					{plans.map((plan, index) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: desktop-only hover spotlight for sibling dimming
						<div
							key={`${plan.name}-${index}`}
							className={cn(
								"max-md:opacity-100",
								"transition-opacity duration-300",
								!prefersReducedMotion &&
									hoveredIndex !== null &&
									hoveredIndex !== index &&
									!plan.popular &&
									"md:opacity-55",
							)}
							onMouseEnter={() => setHoveredIndex(index)}
							data-pricing-card
						>
							<PricingPlanCardWithMotion
								plan={plan}
								index={index}
								loadingIndex={loadingIndex}
								onPlanClick={handlePlanClick}
								enableStagger
								enableTilt
							/>
						</div>
					))}
				</section>
			)}
		</>
	);
}
