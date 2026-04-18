"use client";

import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Skeleton } from "@ui/components/skeleton";
import { useEffect, useRef, useState } from "react";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import { Search, X } from "@/modules/ui/icons";
import { formatDuration } from "../lib/format-duration";
import { VideoRow } from "./video-row";

interface Video {
	id: string;
	title: string;
	thumbnail: string;
	duration: string;
	views: number;
	category: string;
	description?: string;
	isMock?: boolean;
}

interface RawVideo {
	id: string;
	title: string;
	thumbnailUrl: string;
	duration: number;
	category: string;
	description: string | null;
	videoUrl: string;
	orderIndex: number;
	published: boolean;
}

interface StreamingLibraryProps {
	/** Optional initial list from the server — avoids a client-side wait before first render. */
	initialVideos?: RawVideo[];
}

// Map database category to display label
function mapCategoryToLabel(category: string): string {
	const categoryMap: Record<string, string> = {
		"getting-started": "Getting Started",
		advanced: "Advanced Strategies",
		"case-studies": "Case Studies",
		tools: "Tools & Resources",
	};
	return categoryMap[category] || category;
}

function normalizeVideo(v: RawVideo): Video {
	return {
		id: v.id,
		title: v.title,
		thumbnail: v.thumbnailUrl,
		duration: formatDuration(v.duration),
		views: 0,
		category: mapCategoryToLabel(v.category),
		description: v.description || undefined,
		isMock: false,
	};
}

export function StreamingLibrary({
	initialVideos = [],
}: StreamingLibraryProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeSearch, setActiveSearch] = useState("");
	const [videos, setVideos] = useState<Video[]>(() =>
		initialVideos.map(normalizeVideo),
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	async function runSearch(query: string) {
		if (!query.trim()) {
			setVideos(initialVideos.map(normalizeVideo));
			setActiveSearch("");
			return;
		}

		setLoading(true);
		setError(null);
		try {
			const result = await orpcClient.content.videos.list({
				search: query.trim(),
			});
			setVideos(result.videos.map(normalizeVideo));
			setActiveSearch(query.trim());
		} catch (err) {
			if (process.env.NODE_ENV === "development") {
				logger.error("Failed to load videos", { error: err });
			}
			setError("Unable to load videos. Please refresh the page.");
		} finally {
			setLoading(false);
		}
	}

	function handleClear() {
		setSearchQuery("");
		setActiveSearch("");
		setVideos(initialVideos.map(normalizeVideo));
		inputRef.current?.focus();
	}

	useEffect(() => {
		// Keep videos in sync if server-provided initialVideos change.
		if (!activeSearch) {
			setVideos(initialVideos.map(normalizeVideo));
		}
	}, [initialVideos, activeSearch]);

	// Group videos by category
	const videosByCategory = {
		"Getting Started": videos.filter(
			(v) => v.category === "Getting Started",
		),
		"Advanced Strategies": videos.filter(
			(v) => v.category === "Advanced Strategies",
		),
		"Case Studies": videos.filter((v) => v.category === "Case Studies"),
		"Tools & Resources": videos.filter(
			(v) => v.category === "Tools & Resources",
		),
	};

	if (loading) {
		return <LoadingSkeleton />;
	}

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="mb-4 rounded-full bg-destructive/10 p-4">
					<svg
						className="h-8 w-8 text-destructive"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						role="img"
						aria-labelledby="content-library-error-icon-title"
					>
						<title id="content-library-error-icon-title">
							Error
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
					{error}
				</h3>
				<p className="text-sm text-muted-foreground mb-4">
					Something went wrong while loading the content library.
				</p>
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				>
					Refresh Page
				</button>
			</div>
		);
	}

	return (
		<>
			{/* Search Bar */}
			<form
				className="mb-8"
				onSubmit={(e) => {
					e.preventDefault();
					runSearch(searchQuery);
				}}
			>
				<div className="flex max-w-md gap-2">
					<div className="relative flex-1 min-w-0">
						<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
						<Input
							ref={inputRef}
							type="text"
							placeholder="Search courses..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="h-12 rounded-lg border border-border bg-background pl-12 pr-10 text-base"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={handleClear}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								aria-label="Clear search"
							>
								<X className="h-4 w-4" />
							</button>
						)}
					</div>
					<Button
						type="submit"
						disabled={!searchQuery.trim()}
						className="h-12 px-5"
					>
						Search
					</Button>
				</div>
				{activeSearch && (
					<p className="mt-2 text-sm text-muted-foreground">
						Showing results for{" "}
						<span className="font-medium text-foreground">
							"{activeSearch}"
						</span>{" "}
						—{" "}
						<button
							type="button"
							onClick={handleClear}
							className="underline hover:text-foreground"
						>
							clear
						</button>
					</p>
				)}
			</form>

			{/* Video Rows */}
			<div className="space-y-8">
				{Object.entries(videosByCategory).map(
					([category, categoryVideos]) =>
						categoryVideos.length > 0 && (
							<VideoRow
								key={category}
								title={category}
								videos={categoryVideos}
							/>
						),
				)}
			</div>
		</>
	);
}

function LoadingSkeleton() {
	return (
		<div className="space-y-8">
			<div className="h-10 w-64 bg-primary/10 rounded animate-pulse" />
			<div className="flex gap-4 overflow-hidden">
				{Array.from({ length: 5 }, (_, i) => (
					<Skeleton
						key={`skeleton-${i}`}
						className="flex-shrink-0 w-64 h-36"
					/>
				))}
			</div>
		</div>
	);
}
