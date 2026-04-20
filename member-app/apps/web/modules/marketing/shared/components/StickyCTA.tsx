"use client";

import { Button } from "@ui/components/button";
import { useEffect, useState } from "react";
import { ArrowRight } from "@/modules/ui/icons";

interface StickyCTAProps {
	title?: string;
	subtitle?: string;
	buttonText?: string;
	mobileText?: string;
	link?: string;
}

export function StickyCTA({
	title = "Join the LifePreneur Community",
	subtitle = "Live training + private community + affiliate program",
	buttonText = "Get Started",
	mobileText = "Join Now",
	link = "#pricing",
}: StickyCTAProps) {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const checkVisibility = () => {
			const hero = document.getElementById("hero");
			const pricing = document.getElementById("pricing");
			const finalCta = document.getElementById("final-cta");

			if (!hero) {
				return;
			}

			const heroRect = hero.getBoundingClientRect();
			const pastHero = heroRect.bottom < 0;

			// Hide when pricing or final CTA sections are in view
			let pricingInView = false;
			let finalCtaInView = false;

			if (pricing) {
				const pricingRect = pricing.getBoundingClientRect();
				pricingInView =
					pricingRect.top < window.innerHeight &&
					pricingRect.bottom > 0;
			}

			if (finalCta) {
				const finalCtaRect = finalCta.getBoundingClientRect();
				finalCtaInView =
					finalCtaRect.top < window.innerHeight &&
					finalCtaRect.bottom > 0;
			}

			setIsVisible(pastHero && !pricingInView && !finalCtaInView);
		};

		// Throttle scroll handler for performance
		let ticking = false;
		const handleScroll = () => {
			if (!ticking) {
				window.requestAnimationFrame(() => {
					checkVisibility();
					ticking = false;
				});
				ticking = true;
			}
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		checkVisibility();

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	return (
		<div
			className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
				isVisible ? "translate-y-0" : "translate-y-full"
			}`}
			aria-hidden={!isVisible}
		>
			<div className="border-t border-border bg-card/95 shadow-raised backdrop-blur-lg px-4 py-3">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
					<div className="hidden sm:block">
						<p className="text-sm font-semibold text-foreground">
							{title}
						</p>
						<p className="text-xs text-muted-foreground">
							{subtitle}
						</p>
					</div>
					<Button
						size="lg"
						className="group w-full bg-primary text-primary-foreground transition-[transform,box-shadow] hover:scale-105 hover:bg-primary/90 hover:shadow-brand-glow sm:w-auto md:hover:shadow-brand-glow-desktop"
						asChild
					>
						<a href={link}>
							<span className="sm:hidden">{mobileText}</span>
							<span className="hidden sm:inline">
								{buttonText}
							</span>
							<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
