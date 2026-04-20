"use client";

import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import dynamic from "next/dynamic";
import Image from "next/image";
import type React from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Info, Play } from "@/modules/ui/icons";

// Lazy-load both modals — they're large components never needed until user interaction.
const VideoDetailModal = dynamic(
	() =>
		import("./video-detail-modal").then((m) => ({
			default: m.VideoDetailModal,
		})),
	{ ssr: false },
);
const VideoPlayerModal = dynamic(
	() =>
		import("./video-player-modal").then((m) => ({
			default: m.VideoPlayerModal,
		})),
	{ ssr: false },
);

interface Video {
	id: string;
	title: string;
	thumbnail: string;
	duration: string;
	views: number;
	category: string;
	description?: string;
	isMock?: boolean;
	videoUrl?: string;
}

interface VideoRowProps {
	title: string;
	videos: Video[];
}

/**
 * Displays a horizontal scrollable row of video cards with hover effects.
 * Supports both mouse and touch interactions for scrolling.
 *
 * @param title - The category/section title displayed above the row
 * @param videos - Array of video objects to display
 */
export function VideoRow({ title, videos }: VideoRowProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [showLeftArrow, setShowLeftArrow] = useState(false);
	const [showRightArrow, setShowRightArrow] = useState(true);
	const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);
	const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isPlayerOpen, setIsPlayerOpen] = useState(false);
	const [videoToPlay, setVideoToPlay] = useState<Video | null>(null);
	const { ref: inViewRef, isInView } = useInView();

	const scroll = (direction: "left" | "right") => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		const scrollAmount = container.clientWidth * 0.8;
		const newScrollLeft =
			direction === "left"
				? container.scrollLeft - scrollAmount
				: container.scrollLeft + scrollAmount;

		container.scrollTo({
			left: newScrollLeft,
			behavior: "smooth",
		});
	};

	const handleScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		setShowLeftArrow(container.scrollLeft > 0);
		setShowRightArrow(
			container.scrollLeft <
				container.scrollWidth - container.clientWidth - 10,
		);
	};

	const handlePlayClick = (e: React.MouseEvent, video: Video) => {
		e.stopPropagation();

		// Check if video URL is placeholder or missing
		if (
			!video.videoUrl ||
			video.videoUrl.includes("placeholder") ||
			video.videoUrl === "/placeholder.mp4"
		) {
			toast.info("Video coming soon! We're uploading content.", {
				duration: 3000,
			});
			return;
		}

		setVideoToPlay(video);
		setIsPlayerOpen(true);
	};

	return (
		<div
			ref={inViewRef}
			className={cn(
				"group/row relative mb-12 transition-[opacity,transform] duration-700",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-6",
			)}
		>
			{/* Row Title */}
			<h2 className="mb-4 font-serif font-bold tracking-tight text-2xl text-foreground transition-colors group-hover/row:text-primary">
				{title}
			</h2>

			{/* Scroll Container */}
			<div className="relative">
				{/* Left Arrow */}
				{showLeftArrow && (
					<button
						type="button"
						onClick={() => scroll("left")}
						className="absolute left-0 top-0 z-20 hidden h-full w-12 items-center justify-start bg-gradient-to-r from-background via-background/80 to-transparent opacity-0 transition-all duration-300 group-hover/row:opacity-100 hover:scale-110 lg:flex"
						aria-label="Scroll left"
					>
						<div className="flex h-16 w-8 items-center justify-center rounded-r bg-background/50 backdrop-blur-sm transition-all hover:bg-primary/20">
							<ChevronLeft className="h-8 w-8 text-foreground" />
						</div>
					</button>
				)}

				{/* Right Arrow */}
				{showRightArrow && (
					<button
						type="button"
						onClick={() => scroll("right")}
						className="absolute right-0 top-0 z-20 hidden h-full w-12 items-center justify-end bg-gradient-to-l from-background via-background/80 to-transparent opacity-0 transition-all duration-300 group-hover/row:opacity-100 hover:scale-110 lg:flex"
						aria-label="Scroll right"
					>
						<div className="flex h-16 w-8 items-center justify-center rounded-l bg-background/50 backdrop-blur-sm transition-all hover:bg-primary/20">
							<ChevronRight className="h-8 w-8 text-foreground" />
						</div>
					</button>
				)}

				{/* Videos Container */}
				<div
					ref={scrollContainerRef}
					onScroll={handleScroll}
					className="flex gap-4 md:gap-3 overflow-x-auto scroll-smooth scrollbar-hide snap-x snap-mandatory touch-auto overscroll-x-contain lg:snap-none"
					style={{
						scrollbarWidth: "none",
						msOverflowStyle: "none",
						WebkitOverflowScrolling: "touch",
					}}
				>
					{videos.map((video) => (
						// Card opens detail modal; nested Play/Info buttons stop propagation — cannot use a single <button> wrapper.
						// biome-ignore lint/a11y/noStaticElementInteractions: composite card pattern with inner controls
						// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users use inner focusable controls
						<div
							key={video.id}
							className="group/card relative flex-shrink-0 snap-start transition-all duration-300 hover:z-30 active:scale-[0.98]"
							style={{ width: "clamp(200px, 20vw, 320px)" }}
							onMouseEnter={() => setHoveredVideo(video.id)}
							onMouseLeave={() => setHoveredVideo(null)}
							onClick={() => {
								setSelectedVideo(video);
								setIsModalOpen(true);
							}}
						>
							{/* Video Card */}
							<div
								className={`relative cursor-pointer overflow-hidden rounded-lg bg-card shadow-flat transition-[transform,box-shadow] duration-300 ${
									hoveredVideo === video.id
										? "lg:scale-110 shadow-elevated"
										: "hover:shadow-raised"
								}`}
							>
								{/* Thumbnail */}
								<div className="relative aspect-video overflow-hidden bg-muted">
									<Image
										src={
											video.thumbnail ||
											"/placeholder.svg"
										}
										alt={video.title}
										fill
										sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
										loading="lazy"
										className="object-cover transition-all duration-500 group-hover/card:scale-110"
									/>

									{/* Mock Badge */}
									{video.isMock && (
										<div className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
											MOCK
										</div>
									)}

									{/* Duration Badge */}
									<div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
										{video.duration}
									</div>

									{/* Play Overlay */}
									<div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover/card:bg-black/50">
										<div className="scale-0 rounded-full bg-primary p-4 shadow-lg shadow-primary/50 transition-all duration-300 group-hover/card:scale-100">
											<Play className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
										</div>
									</div>
								</div>

								{/* Hover Expanded Info */}
								{hoveredVideo === video.id && (
									<div className="animate-in fade-in slide-in-from-top-2 duration-300 absolute left-0 right-0 top-full hidden z-40 rounded-b-lg border-t-2 border-primary bg-card/95 p-4 shadow-2xl backdrop-blur-md lg:block">
										<h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-tight text-foreground">
											{video.title}
										</h3>
										<div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
											<span>
												{video.views.toLocaleString()}{" "}
												views
											</span>
											<span>•</span>
											<span>{video.duration}</span>
										</div>
										{video.description && (
											<p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
												{video.description}
											</p>
										)}
										<div className="flex gap-2">
											<button
												type="button"
												onClick={(e) =>
													handlePlayClick(e, video)
												}
												className="flex flex-1 items-center justify-center gap-2 rounded bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
											>
												<Play className="h-3 w-3 fill-current" />
												Play
											</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													setSelectedVideo(video);
													setIsModalOpen(true);
												}}
												aria-label={`View details for ${video.title}`}
												className="flex items-center justify-center rounded border border-border bg-background/50 px-3 py-2 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-primary/10"
											>
												<Info className="h-4 w-4" />
											</button>
										</div>
									</div>
								)}
							</div>

							{/* Basic Info (shown when not hovering) */}
							{hoveredVideo !== video.id && (
								<div className="mt-2 px-1">
									<h3 className="line-clamp-1 text-sm font-semibold text-foreground">
										{video.title}
									</h3>
									<p className="text-xs text-muted-foreground">
										{video.views.toLocaleString()} views
									</p>
								</div>
							)}
						</div>
					))}
				</div>
			</div>

			{selectedVideo && (
				<VideoDetailModal
					open={isModalOpen}
					onOpenChange={setIsModalOpen}
					video={selectedVideo}
				/>
			)}

			{/* Video Player Modal for direct playback */}
			{videoToPlay && (
				<VideoPlayerModal
					open={isPlayerOpen}
					onOpenChange={setIsPlayerOpen}
					videoUrl={videoToPlay.videoUrl || "/placeholder.mp4"}
					videoTitle={videoToPlay.title}
					aspectRatio="16:9"
					thumbnail={videoToPlay.thumbnail}
				/>
			)}
		</div>
	);
}
