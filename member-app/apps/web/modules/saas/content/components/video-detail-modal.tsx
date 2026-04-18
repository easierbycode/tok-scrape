"use client";

import { Dialog, DialogContent, DialogTitle } from "@ui/components/dialog";
import dynamic from "next/dynamic";
import Image from "next/image";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Play,
	Plus,
	Share2,
	ThumbsUp,
	X,
} from "@/modules/ui/icons";

const VideoPlayerModal = dynamic(
	() =>
		import("./video-player-modal").then((m) => ({
			default: m.VideoPlayerModal,
		})),
	{ ssr: false },
);

interface Episode {
	number: number;
	title: string;
	description: string;
	duration: string;
	thumbnail: string;
}

interface VideoDetailModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	video: {
		id: string;
		title: string;
		thumbnail: string;
		duration: string;
		views: number;
		category: string;
		description?: string;
		isMock?: boolean;
		videoUrl?: string;
	};
}

/**
 * Full-page modal showing detailed video information including episodes and related content.
 * Includes swipe-to-dismiss gesture on mobile and keyboard navigation support.
 *
 * @param open - Controls modal visibility
 * @param onOpenChange - Callback when modal should close
 * @param video - Video data to display
 */
export function VideoDetailModal({
	open,
	onOpenChange,
	video,
}: VideoDetailModalProps) {
	// Mock episodes data
	const episodes: Episode[] = [
		{
			number: 1,
			title: "Introduction & Setup",
			description:
				"Learn the fundamentals and set up your workspace for success.",
			duration: "12:45",
			thumbnail: video.thumbnail,
		},
		{
			number: 2,
			title: "Core Concepts",
			description:
				"Deep dive into the essential concepts you need to master.",
			duration: "18:30",
			thumbnail: video.thumbnail,
		},
		{
			number: 3,
			title: "Practical Application",
			description:
				"Apply what you've learned with hands-on exercises and real examples.",
			duration: "22:15",
			thumbnail: video.thumbnail,
		},
		{
			number: 4,
			title: "Advanced Techniques",
			description:
				"Master advanced strategies used by top performers in the field.",
			duration: "25:40",
			thumbnail: video.thumbnail,
		},
	];

	const [touchStart, setTouchStart] = useState(0);
	const [touchEnd, setTouchEnd] = useState(0);
	const [currentSimilarIndex, setCurrentSimilarIndex] = useState(0);
	const contentRef = useRef<HTMLDivElement>(null);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);
	const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(
		null,
	);
	const [isLargeScreen, setIsLargeScreen] = useState(false);

	useEffect(() => {
		const checkScreen = () => setIsLargeScreen(window.innerWidth >= 1024);
		checkScreen();
		window.addEventListener("resize", checkScreen);
		return () => window.removeEventListener("resize", checkScreen);
	}, []);

	const handleTouchStart = (e: React.TouchEvent) => {
		setTouchStart(e.targetTouches[0].clientY);
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		setTouchEnd(e.targetTouches[0].clientY);
	};

	const handleTouchEnd = () => {
		if (!touchStart || !touchEnd) {
			return;
		}

		const distance = touchStart - touchEnd;
		const isSwipeDown = distance < -50; // Swipe down threshold

		if (isSwipeDown && contentRef.current?.scrollTop === 0) {
			// Dismiss modal on swipe down from top
			onOpenChange(false);
		}

		setTouchStart(0);
		setTouchEnd(0);
	};

	const handleSimilarPrev = () => {
		setCurrentSimilarIndex((prev) => (prev === 0 ? 2 : prev - 1));
	};

	const handleSimilarNext = () => {
		setCurrentSimilarIndex((prev) => (prev === 2 ? 0 : prev + 1));
	};

	const handlePlayClick = () => {
		setIsPlayerOpen(true);
	};

	const handleEpisodePlay = (episode: Episode) => {
		setSelectedEpisode(episode);
		setIsPlayerOpen(true);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none animate-in fade-in-0 zoom-in-95 duration-300">
				<DialogTitle className="sr-only">{video.title}</DialogTitle>
				<div
					ref={contentRef}
					className="relative max-h-[90vh] overflow-y-auto rounded-xl bg-background shadow-2xl scrollbar-hide lg:overflow-y-auto"
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{/* Close Button */}
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all hover:bg-background hover:scale-110"
						aria-label="Close modal"
					>
						<X className="h-5 w-5" />
					</button>

					{/* Hero Section with Background Image */}
					<div className="relative h-[50vh] min-h-[400px] overflow-hidden">
						{/* Background Image with Gradient Overlay */}
						<div className="absolute inset-0">
							<Image
								src={video.thumbnail || "/placeholder.svg"}
								alt={video.title}
								fill
								sizes="100vw"
								priority
								className="object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
							<div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
						</div>

						{/* Content Overlay */}
						<div className="relative z-10 flex h-full flex-col justify-end p-6 md:p-12">
							{video.isMock && (
								<div className="mb-3 inline-flex w-fit rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
									MOCK PREVIEW
								</div>
							)}
							<h1 className="mb-4 font-serif font-bold tracking-tight text-3xl leading-tight text-foreground drop-shadow-lg md:text-5xl">
								{video.title}
							</h1>

							{/* Action Buttons */}
							<div className="flex flex-wrap gap-3">
								<button
									type="button"
									onClick={handlePlayClick}
									className="flex items-center gap-2 rounded-md bg-white px-6 py-3 font-semibold text-black transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
								>
									<Play className="h-5 w-5 fill-current" />
									Play
								</button>
								<button
									type="button"
									className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background/20 backdrop-blur-sm transition-all hover:border-foreground hover:bg-background/40 hover:scale-110 active:scale-95"
									aria-label="Add to watchlist"
								>
									<Plus className="h-5 w-5" />
								</button>
								<button
									type="button"
									className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background/20 backdrop-blur-sm transition-all hover:border-foreground hover:bg-background/40 hover:scale-110 active:scale-95"
									aria-label="Like"
								>
									<ThumbsUp className="h-5 w-5" />
								</button>
								<button
									type="button"
									className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-muted-foreground/30 bg-background/20 backdrop-blur-sm transition-all hover:border-foreground hover:bg-background/40 hover:scale-110 active:scale-95"
									aria-label="Share"
								>
									<Share2 className="h-5 w-5" />
								</button>
							</div>
						</div>
					</div>

					{/* Details Section */}
					<div className="space-y-8 p-6 md:p-12">
						{/* Metadata Row */}
						<div className="flex flex-wrap items-center gap-3 text-sm">
							<span className="font-semibold text-primary">
								98% Match
							</span>
							<span className="text-muted-foreground">2024</span>
							<span className="rounded border border-muted-foreground/30 px-2 py-0.5 text-xs font-medium">
								HD
							</span>
							<span className="rounded border border-muted-foreground/30 px-2 py-0.5 text-xs font-medium">
								{video.duration}
							</span>
						</div>

						{/* Description */}
						<div className="max-w-2xl">
							<p className="text-base leading-relaxed text-foreground">
								{video.description ||
									"Master the essential skills and strategies you need to succeed. This comprehensive course covers everything from fundamentals to advanced techniques, with practical examples and hands-on exercises."}
							</p>
						</div>

						{/* Metadata */}
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<span className="text-sm text-muted-foreground">
									Category:{" "}
								</span>
								<span className="text-sm font-medium text-foreground">
									{video.category}
								</span>
							</div>
							<div>
								<span className="text-sm text-muted-foreground">
									Views:{" "}
								</span>
								<span className="text-sm font-medium text-foreground">
									{video.views.toLocaleString()}
								</span>
							</div>
						</div>

						{/* Episodes Section */}
						<div className="border-t border-border pt-8">
							<div className="mb-6 flex items-center justify-between">
								<h2 className="font-serif font-bold tracking-tight text-2xl text-foreground">
									Episodes
								</h2>
								<select className="rounded-md border border-border bg-card px-4 py-2 text-sm transition-all hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
									<option>Season 1</option>
								</select>
							</div>

							{/* Episodes List */}
							<div className="space-y-3">
								{episodes.map((episode) => (
									<button
										key={episode.number}
										type="button"
										onClick={() =>
											handleEpisodePlay(episode)
										}
										className="group flex w-full cursor-pointer gap-4 rounded-lg border border-border bg-card/50 p-4 text-left transition-all hover:border-primary/50 hover:bg-card"
									>
										{/* Episode Number */}
										<div className="flex-shrink-0 text-2xl font-bold text-muted-foreground">
											{episode.number}
										</div>

										{/* Episode Thumbnail */}
										<div className="relative h-20 w-36 flex-shrink-0 overflow-hidden rounded bg-muted">
											<Image
												src={
													episode.thumbnail ||
													"/placeholder.svg"
												}
												alt={episode.title}
												fill
												sizes="144px"
												className="object-cover transition-all group-hover:scale-110"
											/>
											{/* Play overlay */}
											<div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/50">
												<Play className="h-6 w-6 scale-0 fill-white text-white transition-all group-hover:scale-100" />
											</div>
										</div>

										{/* Episode Info */}
										<div className="flex-1 min-w-0">
											<div className="mb-1 flex items-start justify-between gap-4">
												<h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
													{episode.title}
												</h3>
												<span className="flex-shrink-0 text-sm text-muted-foreground">
													{episode.duration}
												</span>
											</div>
											<p className="line-clamp-2 text-sm text-muted-foreground">
												{episode.description}
											</p>
										</div>
									</button>
								))}
							</div>
						</div>

						{/* Similar Content Section */}
						<div className="border-t border-border pt-8">
							<div className="mb-6 flex items-center justify-between">
								<h2 className="font-serif font-bold tracking-tight text-xl text-foreground md:text-2xl">
									More Like This
								</h2>
								<div className="hidden gap-2 lg:flex">
									<button
										type="button"
										onClick={handleSimilarPrev}
										className="flex h-10 w-10 items-center justify-center rounded-full bg-card hover:bg-primary/20 border border-border hover:border-primary transition-all hover:scale-110 active:scale-95"
										aria-label="Previous similar videos"
									>
										<ChevronLeft className="h-5 w-5" />
									</button>
									<button
										type="button"
										onClick={handleSimilarNext}
										className="flex h-10 w-10 items-center justify-center rounded-full bg-card hover:bg-primary/20 border border-border hover:border-primary transition-all hover:scale-110 active:scale-95"
										aria-label="Next similar videos"
									>
										<ChevronRight className="h-5 w-5" />
									</button>
								</div>
							</div>

							<div className="relative -mx-6 md:mx-0">
								<div
									className="overflow-x-auto scrollbar-hide lg:overflow-hidden px-6 md:px-0"
									style={{
										WebkitOverflowScrolling: "touch",
									}}
								>
									<div
										className="flex gap-3 snap-x snap-mandatory touch-pan-x sm:gap-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:snap-none"
										style={{
											transform: isLargeScreen
												? `translateX(-${currentSimilarIndex * 33.33}%)`
												: "none",
											transition: isLargeScreen
												? "transform 0.3s ease-in-out"
												: "none",
										}}
									>
										{[
											"similar-1",
											"similar-2",
											"similar-3",
										].map((id, i) => (
											<div
												key={id}
												className="group min-w-[calc(100vw-5rem)] flex-shrink-0 snap-center cursor-pointer overflow-hidden rounded-lg border border-border bg-card shadow-flat transition-[transform,box-shadow,border-color] hover:border-primary/50 hover:shadow-raised active:scale-[0.98] xs:min-w-[280px] sm:min-w-[320px] md:min-w-[340px] lg:min-w-0"
											>
												<div className="relative aspect-video bg-muted overflow-hidden">
													<Image
														src={
															video.thumbnail ||
															"/placeholder.svg"
														}
														alt={`Related course ${i + 1}`}
														fill
														sizes="(max-width: 768px) 100vw, 340px"
														loading="lazy"
														className="object-cover transition-transform duration-300 group-hover:scale-110"
													/>
													<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-all duration-300 group-hover:opacity-100">
														<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110">
															<Play className="h-6 w-6 fill-white text-white" />
														</div>
													</div>
												</div>
												<div className="p-4 space-y-2">
													<h3 className="line-clamp-2 font-semibold text-sm leading-tight text-foreground transition-colors group-hover:text-primary md:text-base">
														Related Course Title {i}
													</h3>
													<div className="flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
														<span className="flex items-center gap-1">
															<span className="h-1 w-1 rounded-full bg-muted-foreground" />
															15:30
														</span>
														<span className="flex items-center gap-1">
															<span className="h-1 w-1 rounded-full bg-muted-foreground" />
															1.2K views
														</span>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>

								<div className="mt-6 flex justify-center gap-3 lg:hidden">
									{["page-0", "page-1", "page-2"].map(
										(pageId, index) => (
											<button
												type="button"
												key={pageId}
												onClick={() =>
													setCurrentSimilarIndex(
														index,
													)
												}
												className={`h-2.5 rounded-full transition-all duration-300 ${
													currentSimilarIndex ===
													index
														? "bg-primary w-8"
														: "bg-muted-foreground/30 w-2.5 hover:bg-muted-foreground/50"
												}`}
												aria-label={`Go to video ${index + 1}`}
											/>
										),
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>

			{/* Video Player Modal */}
			<VideoPlayerModal
				open={isPlayerOpen}
				onOpenChange={setIsPlayerOpen}
				videoUrl={video.videoUrl || "/placeholder.mp4"}
				videoTitle={
					selectedEpisode
						? `${video.title} - ${selectedEpisode.title}`
						: video.title
				}
				aspectRatio="16:9"
				thumbnail={video.thumbnail}
			/>
		</Dialog>
	);
}
