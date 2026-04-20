"use client";

import { TestimonialAvatar } from "@shared/components/TestimonialAvatar";
import { Card } from "@ui/components/card";
import { Dialog, DialogContent, DialogTitle } from "@ui/components/dialog";
import { useState } from "react";
import { Quote, Star } from "@/modules/ui/icons";

interface Testimonial {
	id: string;
	name: string;
	role: string;
	content: string;
	rating: number;
	stats: string;
	avatar: string | null;
}

interface TestimonialsStripProps {
	testimonials: Testimonial[];
}

export function TestimonialsStrip({ testimonials }: TestimonialsStripProps) {
	const [selected, setSelected] = useState<Testimonial | null>(null);

	if (testimonials.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				No testimonials available
			</div>
		);
	}

	const duplicated = [...testimonials, ...testimonials];
	const duration = Math.max(testimonials.length * 8, 30);

	return (
		<>
			{/* Strip — group enables hover-to-pause on the outer container */}
			<div className="group relative overflow-hidden">
				<div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r from-background to-transparent" />
				<div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l from-background to-transparent" />

				<div
					className="flex gap-6 group-hover:[animation-play-state:paused] motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center"
					style={{
						animation: `scroll-testimonials ${duration}s linear infinite`,
						width: "max-content",
					}}
				>
					{duplicated.map((testimonial, index) => (
						<Card
							key={index}
							onClick={() => setSelected(testimonial)}
							className="group/card relative flex w-[350px] flex-shrink-0 cursor-pointer overflow-hidden border-border bg-card shadow-none shadow-flat transition-all duration-300 hover:scale-105 hover:border-primary/50 hover:shadow-elevated md:hover:shadow-elevated-desktop"
						>
							<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover/card:opacity-100" />
							<div className="relative p-6">
								<div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Quote className="h-5 w-5 text-primary" />
								</div>
								<div className="mb-4 flex gap-1">
									{[...Array(testimonial.rating)].map(
										(_, i) => (
											<Star
												key={i}
												className="h-4 w-4 fill-primary text-primary"
												aria-hidden="true"
											/>
										),
									)}
								</div>
								<p className="mb-6 line-clamp-4 font-serif text-lg italic leading-relaxed text-muted-foreground md:text-xl">
									{testimonial.content}
								</p>
								<div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
									<span className="text-xs font-bold text-primary">
										{testimonial.stats}
									</span>
								</div>
								<div className="flex items-center gap-3 border-t border-border pt-4">
									<TestimonialAvatar
										name={testimonial.name}
										avatarUrl={testimonial.avatar}
										className="h-12 w-12"
									/>
									<div>
										<div className="font-semibold text-foreground">
											{testimonial.name}
										</div>
										<div className="text-xs text-muted-foreground">
											{testimonial.role}
										</div>
									</div>
								</div>
							</div>
						</Card>
					))}
				</div>
			</div>

			<p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
				Tap a card to read the full story
			</p>

			{/* Center modal — opens when a card is tapped */}
			<Dialog
				open={!!selected}
				onOpenChange={(open) => !open && setSelected(null)}
			>
				<DialogContent className="max-w-lg gap-0 overflow-hidden rounded-2xl border bg-card p-0 shadow-none shadow-modal md:shadow-modal-desktop">
					{selected && (
						<>
							<DialogTitle className="sr-only">
								Testimonial from {selected.name}
							</DialogTitle>

							{/* Quote body */}
							<div className="px-6 pt-8 pb-6">
								<Quote className="mb-4 h-8 w-8 text-primary/40" />
								<p className="font-serif text-lg italic leading-relaxed text-foreground md:text-xl">
									{selected.content}
								</p>
								{selected.stats && (
									<div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
										<span className="text-sm font-bold text-primary">
											{selected.stats}
										</span>
									</div>
								)}
							</div>

							{/* Author footer */}
							<div className="flex items-center gap-4 border-t border-border bg-muted/30 px-6 py-4">
								<TestimonialAvatar
									name={selected.name}
									avatarUrl={selected.avatar}
									className="h-12 w-12 ring-2 ring-primary/20"
								/>
								<div className="min-w-0 flex-1">
									<div className="font-semibold leading-tight text-foreground">
										{selected.name}
									</div>
									<div className="text-sm text-muted-foreground">
										{selected.role}
									</div>
								</div>
								<div className="flex flex-shrink-0 gap-0.5">
									{[...Array(selected.rating)].map((_, i) => (
										<Star
											key={i}
											className="h-4 w-4 fill-primary text-primary"
											aria-hidden="true"
										/>
									))}
								</div>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
