"use client";

import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
	Award,
	ChevronLeft,
	ChevronRight,
	DollarSign,
	Play,
	PlayCircle,
	TrendingUp,
	Users,
} from "@/modules/ui/icons";

export function TikTokShowcase() {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(true);
	const [playingVideo, setPlayingVideo] = useState<number | null>(null);

	const featuredVideos = [
		{
			id: 1,
			title: "First $10K Day",
			subtitle: "Zero to five figures in 90 days",
			views: "2.4M",
			likes: "180K",
			duration: "5:42",
			category: "SUCCESS",
			thumbnail: "/tiktok-creator-success-story-shopping-products.jpg",
			videoUrl: "/videos/success-story-1.mp4",
		},
		{
			id: 2,
			title: "Complete Shop Setup",
			subtitle: "Step-by-step walkthrough",
			views: "1.8M",
			likes: "142K",
			duration: "8:15",
			category: "TUTORIAL",
			thumbnail: "/tiktok-shop-setup-tutorial-screen-recording.jpg",
			videoUrl: "/videos/shop-setup.mp4",
		},
		{
			id: 3,
			title: "Find Viral Products",
			subtitle: "Discovering winning products",
			views: "3.2M",
			likes: "256K",
			duration: "6:30",
			category: "STRATEGY",
			thumbnail: "/product-research-viral-tiktok-trending.jpg",
			videoUrl: "/videos/viral-products.mp4",
		},
	];

	const checkScrollButtons = () => {
		if (!scrollContainerRef.current) {
			return;
		}
		const { scrollLeft, scrollWidth, clientWidth } =
			scrollContainerRef.current;
		setCanScrollLeft(scrollLeft > 0);
		setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
	};

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) {
			return;
		}

		let startX = 0;
		let scrollLeft = 0;

		const handleTouchStart = (e: TouchEvent) => {
			startX = e.touches[0].pageX;
			scrollLeft = container.scrollLeft;
		};

		const handleTouchMove = (e: TouchEvent) => {
			const x = e.touches[0].pageX;
			const walk = (startX - x) * 2;
			container.scrollLeft = scrollLeft + walk;
		};

		container.addEventListener("touchstart", handleTouchStart);
		container.addEventListener("touchmove", handleTouchMove);

		return () => {
			container.removeEventListener("touchstart", handleTouchStart);
			container.removeEventListener("touchmove", handleTouchMove);
		};
	}, []);

	const scroll = (direction: "left" | "right") => {
		if (!scrollContainerRef.current) {
			return;
		}
		const scrollAmount = 340;
		const newScrollLeft =
			scrollContainerRef.current.scrollLeft +
			(direction === "left" ? -scrollAmount : scrollAmount);
		scrollContainerRef.current.scrollTo({
			left: newScrollLeft,
			behavior: "smooth",
		});
	};

	const handleVideoClick = (id: number) => {
		setPlayingVideo(playingVideo === id ? null : id);
	};

	const courses = [
		{
			title: "TikTok Shop Mastery",
			description:
				"Complete blueprint to launch and scale your TikTok Shop from zero to $10k/month",
			icon: TrendingUp,
			modules: 12,
			duration: "8 weeks",
			level: "Beginner to Advanced",
		},
		{
			title: "Viral Content Formula",
			description:
				"Create content that converts viewers into customers with our proven framework",
			icon: PlayCircle,
			modules: 8,
			duration: "4 weeks",
			level: "All Levels",
		},
		{
			title: "Scaling to 6-Figures",
			description:
				"Advanced strategies to scale your creator business beyond $100k annually",
			icon: DollarSign,
			modules: 10,
			duration: "6 weeks",
			level: "Advanced",
		},
	];

	const features = [
		{ icon: Users, text: "Private Community Access" },
		{ icon: Award, text: "Certification Program" },
		{ icon: TrendingUp, text: "Weekly Live Coaching" },
	];

	return (
		<section
			id="courses"
			className="border-b border-border py-24 md:py-32 bg-gradient-to-b from-background to-muted/20"
		>
			<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
				<div className="mb-16 text-center animate-fade-in-up">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 transition-all hover:scale-105">
						<PlayCircle className="h-4 w-4 text-primary" />
						<span className="text-sm font-semibold text-primary">
							Featured Community Content
						</span>
					</div>
					<h2 className="mb-6 text-balance text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
						Learn From{" "}
						<span className="text-primary">
							Real Success Stories
						</span>
					</h2>
					<p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
						Watch how our community members are winning with TikTok
						Shop. Swipe to explore.
					</p>
				</div>

				<div className="mb-20 relative">
					<div className="hidden lg:block">
						<button
							type="button"
							onClick={() => scroll("left")}
							disabled={!canScrollLeft}
							className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 z-10 rounded-full bg-card/90 backdrop-blur-2xl border border-white/10 p-3.5 shadow-2xl transition-all hover:scale-110 hover:bg-card hover:border-primary/50 disabled:opacity-0 disabled:pointer-events-none"
							aria-label="Scroll left"
						>
							<ChevronLeft className="h-6 w-6 text-foreground" />
						</button>
						<button
							type="button"
							onClick={() => scroll("right")}
							disabled={!canScrollRight}
							className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 z-10 rounded-full bg-card/90 backdrop-blur-2xl border border-white/10 p-3.5 shadow-2xl transition-all hover:scale-110 hover:bg-card hover:border-primary/50 disabled:opacity-0 disabled:pointer-events-none"
							aria-label="Scroll right"
						>
							<ChevronRight className="h-6 w-6 text-foreground" />
						</button>
					</div>

					<div
						ref={scrollContainerRef}
						onScroll={checkScrollButtons}
						className="flex gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 hide-scrollbar px-1 md:justify-center lg:justify-start"
						style={{
							scrollbarWidth: "none",
							msOverflowStyle: "none",
							WebkitOverflowScrolling: "touch",
						}}
					>
						{featuredVideos.map((video, index) => (
							<div
								key={video.id}
								className="group relative flex-shrink-0 snap-center w-[300px] md:w-[320px] animate-fade-in-up"
								style={{ animationDelay: `${index * 100}ms` }}
							>
								<div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-card/90 via-card/75 to-card/60 backdrop-blur-2xl shadow-2xl shadow-black/50 transition-all duration-300 hover:border-primary/40 hover:shadow-primary/25 hover:scale-[1.02]">
									<div className="absolute inset-0 bg-gradient-to-br from-white/[0.12] via-transparent to-primary/[0.08] pointer-events-none rounded-[32px]" />
									<div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)] pointer-events-none" />

									<div className="relative aspect-[9/16] overflow-hidden rounded-[28px] m-2.5">
										{playingVideo === video.id ? (
											<video
												className="absolute inset-0 h-full w-full object-cover"
												src={video.videoUrl}
												controls
												autoPlay
												playsInline
												onEnded={() =>
													setPlayingVideo(null)
												}
											>
												{/* Caption tracks are not yet produced for featured reels. */}
												<track kind="captions" />
											</video>
										) : (
											<>
												<Image
													src={video.thumbnail}
													alt={video.title}
													fill
													sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
													className="object-cover transition-transform duration-500 group-hover:scale-105"
													loading="lazy"
												/>
												<div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

												<div className="absolute top-4 right-4">
													<span className="rounded-xl bg-black/80 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white border border-white/20 shadow-2xl">
														{video.duration}
													</span>
												</div>

												<div className="absolute top-4 left-4">
													<span className="rounded-xl bg-primary/95 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white uppercase tracking-wider border border-white/30 shadow-2xl">
														{video.category}
													</span>
												</div>

												<button
													type="button"
													onClick={() =>
														handleVideoClick(
															video.id,
														)
													}
													className="absolute inset-0 flex items-center justify-center group/play"
													aria-label={`Play ${video.title}`}
												>
													<div className="absolute rounded-full bg-primary/50 blur-3xl w-28 h-28 opacity-0 group-hover/play:opacity-100 transition-opacity duration-500" />

													<div className="relative rounded-full bg-white/25 backdrop-blur-xl border-2 border-white/40 p-5 transition-all duration-300 group-hover/play:scale-110 group-hover/play:bg-primary/95 group-hover/play:border-white/60 shadow-2xl">
														<Play
															className="h-8 w-8 text-white fill-white"
															strokeWidth={0}
														/>
													</div>
												</button>

												<div className="absolute bottom-0 left-0 right-0 p-5 space-y-3">
													<h3 className="text-xl font-bold text-white text-balance leading-tight drop-shadow-2xl">
														{video.title}
													</h3>
													<p className="text-sm text-white/90 leading-relaxed drop-shadow-lg">
														{video.subtitle}
													</p>

													<div className="flex items-center gap-3 text-xs font-medium text-white/90">
														<span className="flex items-center gap-1.5">
															<TrendingUp className="h-3.5 w-3.5" />
															{video.views}
														</span>
														<span className="text-white/50">
															•
														</span>
														<span>
															❤️ {video.likes}
														</span>
													</div>
												</div>
											</>
										)}
									</div>
								</div>
							</div>
						))}
					</div>

					<style jsx>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}</style>
				</div>

				<div className="mb-16 text-center">
					<h3 className="mb-6 text-3xl font-bold text-foreground md:text-4xl">
						Your Path to{" "}
						<span className="text-primary">Creator Success</span>
					</h3>
					<p className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground mb-12">
						Transform your TikTok presence with our comprehensive
						training programs
					</p>
				</div>

				<div className="mb-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{courses.map((course, index) => (
						<Card
							key={index}
							className="group relative overflow-hidden border-border bg-card/50 backdrop-blur-xl transition-all duration-300 hover:border-primary/50 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/10"
						>
							<div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
							<div className="relative p-6">
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-all group-hover:scale-110 group-hover:bg-primary/20">
									<course.icon className="h-6 w-6 text-primary" />
								</div>
								<h3 className="mb-3 text-xl font-bold text-foreground">
									{course.title}
								</h3>
								<p className="mb-6 text-sm leading-relaxed text-muted-foreground">
									{course.description}
								</p>
								<div className="mb-6 space-y-2 border-t border-border pt-4">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Modules
										</span>
										<span className="font-semibold text-foreground">
											{course.modules}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Duration
										</span>
										<span className="font-semibold text-foreground">
											{course.duration}
										</span>
									</div>
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">
											Level
										</span>
										<span className="font-semibold text-foreground">
											{course.level}
										</span>
									</div>
								</div>
								<Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/20">
									Learn More
								</Button>
							</div>
						</Card>
					))}
				</div>

				<div className="grid gap-6 md:grid-cols-3">
					{features.map((feature, index) => (
						<div
							key={index}
							className="flex items-center gap-4 rounded-lg border border-border bg-card/50 backdrop-blur-xl p-6 transition-all hover:scale-105 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-all hover:scale-110">
								<feature.icon className="h-5 w-5 text-primary" />
							</div>
							<span className="font-semibold text-foreground">
								{feature.text}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
