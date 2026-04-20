"use client";

import { Logo } from "@shared/components/Logo";
import { Button } from "@ui/components/button";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowRight, RefreshCw, Sparkles } from "@/modules/ui/icons";

export function HomepageOffline() {
	const [isRefreshing, setIsRefreshing] = useState(false);

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		// Small delay so spinner is visible, then reload
		setTimeout(() => {
			window.location.reload();
		}, 600);
	}, []);

	return (
		<div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5 py-8 sm:px-6 md:px-8">
			{/* Ambient background glow — scaled for mobile first, larger on desktop */}
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl sm:h-80 sm:w-80 md:h-[32rem] md:w-[32rem] md:blur-[100px]" />
				<div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/5 blur-2xl sm:h-64 sm:w-64 md:-bottom-32 md:-left-32 md:h-96 md:w-96 md:blur-3xl" />
				<div className="absolute -right-16 top-1/2 h-48 w-48 rounded-full bg-secondary/5 blur-2xl sm:h-64 sm:w-64 md:-right-32 md:h-96 md:w-96 md:blur-3xl" />
			</div>

			<div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 text-center sm:max-w-md md:max-w-xl md:gap-8">
				{/* Logo */}
				<Link href="/" className="active:scale-95 transition-transform">
					<Logo withLabel />
				</Link>

				{/* Status badge - echoes hero badge style */}
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 sm:px-4 sm:py-2">
					<Sparkles className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
					<span className="text-xs font-semibold text-primary sm:text-sm">
						Quick Update in Progress
					</span>
				</div>

				{/* Copy */}
				<div className="flex flex-col gap-3 md:gap-4">
					<h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
						Building Something{" "}
						<span className="text-primary">Better</span>
					</h1>
					<p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
						LifePreneur is momentarily offline while we make
						improvements. Your journey to building a thriving
						creator business continues shortly.
					</p>
				</div>

				{/* Value reinforcement - what they're coming back to */}
				<div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm">
					{["Courses", "Community", "Coaching"].map((item) => (
						<div
							key={item}
							className="flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 sm:px-3 sm:py-1.5"
						>
							<div className="h-1 w-1 rounded-full bg-primary sm:h-1.5 sm:w-1.5" />
							<span>{item}</span>
						</div>
					))}
				</div>

				{/* CTAs - full width on mobile for better tap targets */}
				<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
					<Button
						size="lg"
						className="w-full bg-primary text-primary-foreground active:scale-[0.98] sm:w-auto sm:hover:scale-105 sm:hover:shadow-xl sm:hover:shadow-primary/30 transition-all"
						onClick={handleRefresh}
						disabled={isRefreshing}
					>
						{isRefreshing ? (
							<>
								<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
								Checking...
							</>
						) : (
							<>
								<RefreshCw className="mr-2 h-4 w-4" />
								Try Again
							</>
						)}
					</Button>
					<Button
						size="lg"
						variant="outline"
						className="w-full border-border active:scale-[0.98] sm:w-auto sm:hover:border-primary/50 sm:hover:bg-primary/5 transition-all"
						asChild
					>
						<Link href="/contact">
							Get in touch
							<ArrowRight className="ml-2 h-4 w-4 sm:transition-transform sm:group-hover:translate-x-1" />
						</Link>
					</Button>
				</div>

				{/* Reassurance */}
				<p className="text-[11px] text-muted-foreground/70 sm:text-xs">
					This usually resolves within minutes. No action needed on
					your part.
				</p>
			</div>
		</div>
	);
}
