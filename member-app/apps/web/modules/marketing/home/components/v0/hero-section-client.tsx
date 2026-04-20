"use client";

import { parseHeroVideoUrl } from "@marketing/home/lib/parse-hero-video-url";
import { TestimonialAvatar } from "@shared/components/TestimonialAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Skeleton } from "@ui/components/skeleton";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ArrowRight, Play } from "@/modules/ui/icons";

export interface HeroSectionClientProps {
	badgeText: string;
	headline: string;
	headlineAccent?: string | null;
	subheadline: string;
	ctaText: string;
	videoUrl: string | null;
	thumbnailSrc: string;
}

function renderHeadline(headline: string, accent: string | null | undefined) {
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
	// Fallback: last word in orange
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

function HeroThumbnailMedia(props: {
	src: string;
	alt: string;
	priority?: boolean;
}) {
	const { src, alt, priority } = props;
	const isRemote = src.startsWith("http://") || src.startsWith("https://");
	return (
		<Image
			src={src}
			alt={alt}
			fill
			sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, (max-width: 1024px) 380px, 420px"
			className="object-cover"
			priority={priority}
			unoptimized={isRemote}
		/>
	);
}

export function HeroSectionClient(props: HeroSectionClientProps) {
	const {
		badgeText,
		headline,
		headlineAccent,
		subheadline,
		ctaText,
		videoUrl,
		thumbnailSrc,
	} = props;

	const [isPlaying, setIsPlaying] = useState(false);

	const parsedVideo = useMemo(() => parseHeroVideoUrl(videoUrl), [videoUrl]);

	const canPlayVideo =
		parsedVideo.kind === "youtube" || parsedVideo.kind === "direct";

	const youtubePlaySrc =
		parsedVideo.kind === "youtube" && parsedVideo.embedSrc
			? `${parsedVideo.embedSrc}${parsedVideo.embedSrc.includes("?") ? "&" : "?"}autoplay=1&mute=0&controls=1&modestbranding=1&rel=0`
			: null;

	const { data: testimonials = [], isLoading: isLoadingTestimonials } =
		useQuery({
			...orpc.testimonials.list.queryOptions(),
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
			refetchOnWindowFocus: false,
		});

	const topCreators = testimonials.slice(0, 5);

	const handlePlay = useCallback(() => {
		if (!canPlayVideo) {
			return;
		}
		setIsPlaying(true);
	}, [canPlayVideo]);

	const thumbnailAlt = `Preview: ${headline}`;

	return (
		<section
			id="hero"
			className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-20"
		>
			<div className="relative z-10 px-4 md:px-8">
				<div className="mx-auto max-w-7xl">
					<div className="flex flex-col items-center text-center gap-6 mb-12 md:mb-16 animate-fade-in-up">
						<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2.5">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
							</span>
							<span className="text-sm font-semibold text-primary">
								{badgeText}
							</span>
						</div>

						<h1 className="max-w-4xl text-balance font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl lg:text-6xl xl:text-7xl">
							{renderHeadline(headline, headlineAccent)}
						</h1>

						<p className="max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
							{subheadline}
						</p>
					</div>

					<div className="relative flex items-center justify-center mb-12 md:mb-16">
						<div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-[380px] lg:max-w-[420px]">
							<div className="absolute -inset-8 md:-inset-12 lg:-inset-16 rounded-[4rem] bg-primary/15 blur-[60px] md:blur-[80px]" />

							<div className="relative z-10 rounded-[2.5rem] md:rounded-[3rem] bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 p-[3px] md:p-1 shadow-[0_0_60px_rgba(232,101,10,0.15),0_25px_50px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]">
								<div className="rounded-[2.4rem] md:rounded-[2.85rem] bg-black overflow-hidden">
									<div className="relative flex justify-center pt-2.5 md:pt-3">
										<div className="h-6 md:h-7 w-24 md:w-28 rounded-full bg-black border border-zinc-800/50" />
									</div>

									<div className="flex items-center justify-between px-6 md:px-7 py-1 md:py-1.5">
										<span className="text-xs md:text-sm font-semibold text-white">
											9:41
										</span>
										<div className="flex items-center gap-1.5">
											<svg
												className="h-3.5 md:h-4 w-3.5 md:h-4 text-white"
												fill="currentColor"
												viewBox="0 0 20 20"
												aria-hidden="true"
											>
												<path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
											</svg>
											<svg
												className="h-3 md:h-3.5 w-3 md:w-3.5 text-white"
												fill="currentColor"
												viewBox="0 0 20 20"
												aria-hidden="true"
											>
												<path
													fillRule="evenodd"
													d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z"
												/>
											</svg>
											<div className="flex items-end gap-px">
												<div className="h-2.5 md:h-3 w-[2px] bg-white rounded-[1px]" />
												<div className="h-3 md:h-3.5 w-[2px] bg-white rounded-[1px]" />
												<div className="h-2 md:h-2.5 w-[2px] bg-white/50 rounded-[1px]" />
											</div>
										</div>
									</div>

									<div className="relative aspect-[9/16] bg-zinc-950">
										{isPlaying &&
										parsedVideo.kind === "youtube" &&
										youtubePlaySrc ? (
											<iframe
												src={youtubePlaySrc}
												className="absolute inset-0 h-full w-full"
												allow="autoplay; fullscreen"
												frameBorder="0"
												title="Marketing hero video"
											/>
										) : null}
										{isPlaying &&
										parsedVideo.kind === "direct" &&
										parsedVideo.fileSrc ? (
											// biome-ignore lint/a11y/useMediaCaption: Optional marketing clip; captions not provided by CMS
											<video
												src={parsedVideo.fileSrc}
												className="absolute inset-0 h-full w-full object-cover"
												controls
												autoPlay
												playsInline
												title="Marketing hero video"
											/>
										) : null}
										{!isPlaying ? (
											<>
												<HeroThumbnailMedia
													src={thumbnailSrc}
													alt={thumbnailAlt}
													priority
												/>
												<div className="absolute inset-0 bg-black/20" />
												{canPlayVideo ? (
													<button
														type="button"
														onClick={handlePlay}
														className="absolute inset-0 flex items-center justify-center group cursor-pointer"
														aria-label="Play video"
													>
														<div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-full bg-primary/90 shadow-none backdrop-blur-sm transition-all group-hover:scale-110 group-hover:bg-primary group-hover:shadow-brand-glow md:group-hover:shadow-brand-glow-desktop">
															<Play className="h-7 w-7 md:h-9 md:w-9 text-white ml-1" />
														</div>
													</button>
												) : null}
												<div className="absolute top-3 left-3 md:top-4 md:left-4 flex items-center gap-2 pointer-events-none">
													<div className="rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 border border-white/20">
														<span className="text-[10px] sm:text-xs font-bold text-white">
															#Community
														</span>
													</div>
													<div className="rounded-full bg-primary px-2.5 py-1 shadow-lg shadow-primary/40">
														<span className="text-[10px] sm:text-xs font-bold text-white">
															LIVE
														</span>
													</div>
												</div>
											</>
										) : null}
									</div>

									<div className="flex justify-center py-2.5 md:py-3 bg-black">
										<div className="h-1 md:h-1.5 w-28 md:w-32 rounded-full bg-white/30" />
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className="flex flex-col items-center gap-8 animate-fade-in-up">
						<Button
							size="lg"
							className="group bg-primary text-primary-foreground transition-[transform,box-shadow] hover:scale-105 hover:bg-primary/90 hover:shadow-brand-glow md:hover:shadow-brand-glow-desktop"
							asChild
						>
							<a href="#pricing">
								{ctaText}
								<ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
							</a>
						</Button>

						<div className="flex items-center gap-8">
							<div className="flex -space-x-3">
								{isLoadingTestimonials
									? [1, 2, 3, 4, 5].map((i) => (
											<Skeleton
												key={i}
												className="h-10 w-10 rounded-full border-2 border-background ring-2 ring-primary/20"
											/>
										))
									: topCreators.length > 0
										? topCreators.map((creator) => (
												<TestimonialAvatar
													key={creator.id}
													name={creator.name}
													avatarUrl={creator.avatar}
													className="h-10 w-10 rounded-full border-2 border-background ring-2 ring-primary/20"
												/>
											))
										: [1, 2, 3, 4, 5].map((i) => (
												<div
													key={i}
													className="relative h-10 w-10 rounded-full border-2 border-background bg-muted ring-2 ring-primary/20 overflow-hidden"
												>
													<Image
														src={`/placeholder.svg?height=40&width=40&query=creator+avatar+${i}`}
														alt={`Creator ${i}`}
														fill
														sizes="40px"
														className="object-cover"
														loading="lazy"
													/>
												</div>
											))}
							</div>
							<div>
								<div className="flex items-center gap-1">
									{[...Array(5)].map((_, i) => (
										<svg
											key={i}
											className="h-4 w-4 fill-primary"
											viewBox="0 0 20 20"
											aria-hidden="true"
										>
											<path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
										</svg>
									))}
								</div>
								<p className="text-sm text-muted-foreground">
									300+ active members
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute -right-1/4 top-0 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute -left-1/4 bottom-0 h-96 w-96 rounded-full bg-secondary/5 blur-3xl" />
			</div>
		</section>
	);
}
