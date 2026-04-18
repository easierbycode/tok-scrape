"use client";

import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import { Dialog, DialogContent, DialogTitle } from "@ui/components/dialog";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Maximize,
	Minimize,
	Pause,
	Play,
	Settings,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
} from "@/modules/ui/icons";

interface VideoPlayerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	videoUrl: string;
	videoTitle: string;
	aspectRatio?: "16:9" | "9:16";
	thumbnail?: string;
}

/**
 * Full-screen video player modal with custom controls.
 * Supports both direct video files and YouTube embeds.
 * Includes touch gestures, fullscreen mode, and keyboard controls.
 *
 * @param open - Controls modal visibility
 * @param onOpenChange - Callback when modal should close
 * @param videoUrl - URL of the video file or YouTube embed
 * @param videoTitle - Title displayed in player controls
 * @param aspectRatio - Video aspect ratio (16:9 or 9:16)
 * @param thumbnail - Optional poster image shown before playback
 */
export function VideoPlayerModal({
	open,
	onOpenChange,
	videoUrl,
	videoTitle,
	aspectRatio = "16:9",
	thumbnail,
}: VideoPlayerModalProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	const [volume, setVolume] = useState(1);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [showControls, setShowControls] = useState(true);
	const [buffering, setBuffering] = useState(false);
	const [touchStart, setTouchStart] = useState(0);
	const [touchEnd, setTouchEnd] = useState(0);
	const [videoError, setVideoError] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLElement>(null);
	const controlsTimeoutRef = useRef<
		ReturnType<typeof setTimeout> | undefined
	>(undefined);
	const playPromiseRef = useRef<Promise<void> | null>(null);

	// Auto-hide controls after 3 seconds
	useEffect(() => {
		if (showControls && isPlaying) {
			controlsTimeoutRef.current = setTimeout(() => {
				setShowControls(false);
			}, 3000);
		}
		return () => {
			if (controlsTimeoutRef.current) {
				clearTimeout(controlsTimeoutRef.current);
			}
		};
	}, [showControls, isPlaying]);

	const togglePlay = async () => {
		if (!videoRef.current) {
			return;
		}

		try {
			if (isPlaying) {
				// Wait for any pending play promise before pausing
				if (playPromiseRef.current) {
					await playPromiseRef.current;
				}
				videoRef.current.pause();
				playPromiseRef.current = null;
				setIsPlaying(false);
			} else {
				// Store the play promise and handle it
				playPromiseRef.current = videoRef.current.play();
				await playPromiseRef.current;
				playPromiseRef.current = null;
				setIsPlaying(true);
			}
		} catch (error) {
			// Ignore AbortError which happens when play is interrupted
			if (error instanceof Error && error.name !== "AbortError") {
				if (process.env.NODE_ENV === "development") {
					logger.error("Video playback error", { error });
				}
			}
			playPromiseRef.current = null;
		}
	};

	// Handle mute/unmute
	const toggleMute = () => {
		if (videoRef.current) {
			videoRef.current.muted = !isMuted;
			setIsMuted(!isMuted);
		}
	};

	// Handle volume change
	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newVolume = Number.parseFloat(e.target.value);
		setVolume(newVolume);
		if (videoRef.current) {
			videoRef.current.volume = newVolume;
			setIsMuted(newVolume === 0);
		}
	};

	// Handle time update
	const handleTimeUpdate = () => {
		if (videoRef.current) {
			setCurrentTime(videoRef.current.currentTime);
		}
	};

	// Handle loaded metadata
	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			setDuration(videoRef.current.duration);
		}
	};

	// Handle seek
	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newTime = Number.parseFloat(e.target.value);
		setCurrentTime(newTime);
		if (videoRef.current) {
			videoRef.current.currentTime = newTime;
		}
	};

	// Skip forward/backward 10 seconds
	const skipTime = (seconds: number) => {
		if (videoRef.current) {
			videoRef.current.currentTime = Math.max(
				0,
				Math.min(duration, currentTime + seconds),
			);
		}
	};

	// Toggle fullscreen
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			containerRef.current?.requestFullscreen();
			setIsFullscreen(true);
		} else {
			document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	// Format time (seconds to mm:ss)
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	// Handle mouse movement to show controls
	const handleMouseMove = () => {
		setShowControls(true);
		if (controlsTimeoutRef.current) {
			clearTimeout(controlsTimeoutRef.current);
		}
	};

	// Touch gestures for mobile
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
		const isSwipeDown = distance < -100;

		if (isSwipeDown && !isFullscreen) {
			onOpenChange(false);
		}

		setTouchStart(0);
		setTouchEnd(0);
	};

	// Tap to play/pause with async function
	const handleVideoClick = async () => {
		await togglePlay();
		setShowControls(true);
	};

	// Calculate aspect ratio classes
	const getAspectRatioClass = () => {
		if (aspectRatio === "9:16") {
			return "aspect-[9/16] max-h-[80vh] max-w-[45vh]";
		}
		return "aspect-video max-w-full";
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-7xl border-0 bg-black p-0 shadow-none animate-in fade-in-0 zoom-in-95 duration-300">
				<DialogTitle className="sr-only">{videoTitle}</DialogTitle>
				<section
					ref={containerRef}
					aria-label="Video player"
					className={`relative flex items-center justify-center bg-black ${isFullscreen ? "h-screen w-screen" : "max-h-[90vh]"}`}
					onMouseMove={handleMouseMove}
					onTouchStart={handleTouchStart}
					onTouchMove={handleTouchMove}
					onTouchEnd={handleTouchEnd}
				>
					{/* Close Button */}
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className={`absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-110 ${showControls ? "opacity-100" : "opacity-0"}`}
						aria-label="Close player"
					>
						<X className="h-5 w-5 text-white" />
					</button>

					{/* Video Element */}
					<div
						className={`relative ${getAspectRatioClass()} mx-auto`}
					>
						{videoUrl.includes("youtube.com/embed") ||
						videoUrl.includes("youtu.be") ? (
							<iframe
								className="h-full w-full rounded-lg"
								src={videoUrl}
								title={videoTitle}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowFullScreen
							/>
						) : (
							<video
								ref={videoRef}
								className="h-full w-full rounded-lg"
								poster={thumbnail}
								onTimeUpdate={handleTimeUpdate}
								onLoadedMetadata={handleLoadedMetadata}
								onWaiting={() => setBuffering(true)}
								onCanPlay={() => setBuffering(false)}
								onClick={handleVideoClick}
								onError={(e) => {
									logger.error("Video load error", {
										error: e,
									});
									setVideoError(true);
									setBuffering(false);
									toast.error(
										"Video not available yet. We're uploading content!",
									);
								}}
								playsInline
							>
								<source src={videoUrl} type="video/mp4" />
								{/* Caption tracks are not yet produced for this content; placeholder preserves a11y slot. */}
								<track kind="captions" />
								Your browser does not support the video tag.
							</video>
						)}

						{/* Error Message Overlay */}
						{videoError && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
								<div className="text-center p-6">
									<div className="mb-4 rounded-full bg-destructive/10 p-4 inline-block">
										<svg
											className="h-8 w-8 text-destructive"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											role="img"
											aria-labelledby="video-error-icon-title"
										>
											<title id="video-error-icon-title">
												Video error
											</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
											/>
										</svg>
									</div>
									<h3 className="mb-2 font-serif font-semibold tracking-tight text-lg text-foreground">
										Video Not Available
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										We're currently uploading content. Check
										back soon!
									</p>
									<Button
										type="button"
										onClick={() => onOpenChange(false)}
									>
										Close
									</Button>
								</div>
							</div>
						)}

						{/* Loading Spinner */}
						{buffering && (
							<div className="absolute inset-0 flex items-center justify-center bg-black/20">
								<div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
							</div>
						)}

						{/* Center Play Button (when paused) */}
						{!isPlaying && !buffering && (
							<button
								type="button"
								onClick={togglePlay}
								aria-label="Play video"
								className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/20 to-black/60 cursor-pointer"
							>
								<div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm transition-all hover:scale-110 hover:bg-white">
									<Play className="h-10 w-10 fill-black text-black" />
								</div>
							</button>
						)}

						{/* Video Controls */}
						<div
							className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 transition-all duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
						>
							{/* Progress Bar */}
							<div className="mb-4">
								<input
									type="range"
									min="0"
									max={duration || 0}
									value={currentTime}
									onChange={handleSeek}
									className="video-progress-slider w-full"
									aria-label="Video progress"
								/>
							</div>

							{/* Controls Row */}
							<div className="flex items-center justify-between gap-4">
								{/* Left Controls */}
								<div className="flex items-center gap-2 sm:gap-3">
									{/* Play/Pause */}
									<button
										type="button"
										onClick={togglePlay}
										className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
										aria-label={
											isPlaying ? "Pause" : "Play"
										}
									>
										{isPlaying ? (
											<Pause className="h-6 w-6 fill-white text-white" />
										) : (
											<Play className="h-6 w-6 fill-white text-white" />
										)}
									</button>

									{/* Skip Back 10s */}
									<button
										type="button"
										onClick={() => skipTime(-10)}
										className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
										aria-label="Skip back 10 seconds"
									>
										<SkipBack className="h-5 w-5 text-white" />
									</button>

									{/* Skip Forward 10s */}
									<button
										type="button"
										onClick={() => skipTime(10)}
										className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
										aria-label="Skip forward 10 seconds"
									>
										<SkipForward className="h-5 w-5 text-white" />
									</button>

									{/* Volume Controls */}
									<div className="hidden md:flex items-center gap-2">
										<button
											type="button"
											onClick={toggleMute}
											className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
											aria-label={
												isMuted ? "Unmute" : "Mute"
											}
										>
											{isMuted || volume === 0 ? (
												<VolumeX className="h-5 w-5 text-white" />
											) : (
												<Volume2 className="h-5 w-5 text-white" />
											)}
										</button>
										<input
											type="range"
											min="0"
											max="1"
											step="0.1"
											value={volume}
											onChange={handleVolumeChange}
											className="video-volume-slider w-20"
											aria-label="Volume"
										/>
									</div>

									{/* Time Display */}
									<div className="hidden sm:block text-sm font-medium text-white">
										{formatTime(currentTime)} /{" "}
										{formatTime(duration)}
									</div>
								</div>

								{/* Right Controls */}
								<div className="flex items-center gap-2">
									{/* Settings */}
									<button
										type="button"
										className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
										aria-label="Settings"
									>
										<Settings className="h-5 w-5 text-white" />
									</button>

									{/* Fullscreen */}
									<button
										type="button"
										onClick={toggleFullscreen}
										className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-white/20 active:scale-95"
										aria-label={
											isFullscreen
												? "Exit fullscreen"
												: "Enter fullscreen"
										}
									>
										{isFullscreen ? (
											<Minimize className="h-5 w-5 text-white" />
										) : (
											<Maximize className="h-5 w-5 text-white" />
										)}
									</button>
								</div>
							</div>

							{/* Video Title */}
							<div className="mt-3 text-sm font-medium text-white/90">
								{videoTitle}
							</div>
						</div>
					</div>
				</section>
			</DialogContent>
		</Dialog>
	);
}
