"use client";

import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { EmptyState } from "@ui/components/empty-state";
import { Bell, BellOff, Check, CheckCheck, Filter } from "@/modules/ui/icons";
import type { Announcement } from "../lib/types";
import { AnnouncementCard } from "./announcement-card";

interface AnnouncementsTabProps {
	announcements: Announcement[];
	filter: "all" | "unread";
	typeFilter: string;
	onFilterChange: (filter: "all" | "unread") => void;
	onTypeFilterChange: (type: string) => void;
	onMarkAsRead: (id: string) => void;
	onMarkAllAsRead: () => void;
	onAnnouncementClick: (announcement: Announcement) => void;
}

export function AnnouncementsTab({
	announcements,
	filter,
	typeFilter,
	onFilterChange,
	onTypeFilterChange,
	onMarkAsRead,
	onMarkAllAsRead,
	onAnnouncementClick,
}: AnnouncementsTabProps) {
	const unreadCount = announcements.filter((a) => !a.read).length;

	// Apply both filters
	let filteredAnnouncements = announcements;

	// Filter by read status
	if (filter === "unread") {
		filteredAnnouncements = filteredAnnouncements.filter((a) => !a.read);
	}

	// Filter by type
	if (typeFilter !== "all") {
		filteredAnnouncements = filteredAnnouncements.filter(
			(a) => a.type === typeFilter,
		);
	}

	// Get unique types for filter dropdown
	const availableTypes = Array.from(
		new Set(announcements.map((a) => a.type)),
	);
	const activeFilterCount =
		(filter === "unread" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0);

	return (
		<div className="space-y-4 sm:space-y-6">
			{/* Header Card */}
			<Card className="mb-4 overflow-hidden border-2 border-border/50">
				<CardContent className="p-4 sm:p-6">
					<div className="flex flex-col gap-3 sm:gap-4">
						{/* Row 1: Title + Mark All Read */}
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2">
								<Bell className="h-5 w-5 shrink-0 text-muted-foreground" />
								<h2 className="font-serif font-bold tracking-tight text-base sm:text-lg md:text-xl">
									{announcements.length}{" "}
									{announcements.length === 1
										? "Announcement"
										: "Announcements"}
								</h2>
							</div>

							{unreadCount > 0 && (
								<Button
									variant="secondary"
									size="sm"
									onClick={onMarkAllAsRead}
									className="shrink-0 min-h-[44px] gap-1.5 px-3 font-medium sm:min-h-[36px] sm:px-4"
								>
									<CheckCheck className="h-4 w-4" />
									<span className="hidden sm:inline">
										Mark All Read
									</span>
								</Button>
							)}
						</div>

						{/* Row 2: Filter Controls */}
						<div className="flex flex-wrap items-center gap-2">
							{/* Read Status Filter */}
							<Button
								variant={
									filter === "all" ? "primary" : "secondary"
								}
								size="sm"
								onClick={() => onFilterChange("all")}
								className="min-h-[44px] px-4 sm:min-h-[36px]"
							>
								All
							</Button>
							<Button
								variant={
									filter === "unread"
										? "primary"
										: "secondary"
								}
								size="sm"
								onClick={() => onFilterChange("unread")}
								className="min-h-[44px] gap-1.5 px-4 sm:min-h-[36px]"
							>
								<Bell className="h-3.5 w-3.5" />
								Unread
								{unreadCount > 0 && (
									<span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-semibold leading-none text-primary">
										{unreadCount}
									</span>
								)}
							</Button>

							{/* Type Filter Dropdown */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant={
											typeFilter !== "all"
												? "primary"
												: "secondary"
										}
										size="sm"
										className="min-h-[44px] gap-1.5 px-3 sm:min-h-[36px] sm:px-4"
									>
										<Filter className="h-4 w-4" />
										<span className="sm:inline">
											{typeFilter !== "all"
												? typeFilter
														.charAt(0)
														.toUpperCase() +
													typeFilter.slice(1)
												: "Filter"}
										</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem
										onClick={() =>
											onTypeFilterChange("all")
										}
									>
										<div className="flex w-full items-center justify-between">
											<span>All Types</span>
											{typeFilter === "all" && (
												<Check className="ml-2 h-4 w-4" />
											)}
										</div>
									</DropdownMenuItem>
									{availableTypes.map((type) => (
										<DropdownMenuItem
											key={type}
											onClick={() =>
												onTypeFilterChange(type)
											}
										>
											<div className="flex w-full items-center justify-between">
												<span>
													{type
														.charAt(0)
														.toUpperCase() +
														type.slice(1)}
												</span>
												{typeFilter === type && (
													<Check className="ml-2 h-4 w-4" />
												)}
											</div>
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>

							{/* Clear Filters */}
							{activeFilterCount > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										onFilterChange("all");
										onTypeFilterChange("all");
									}}
									className="min-h-[44px] text-xs sm:min-h-[36px]"
								>
									Clear ({activeFilterCount})
								</Button>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Announcements List */}
			<div className="space-y-3 sm:space-y-4">
				{filteredAnnouncements.length === 0 ? (
					<Card className="overflow-hidden border-2 border-border/50">
						<EmptyState
							icon={<BellOff className="size-6" />}
							title={
								filter === "unread"
									? "All Caught Up!"
									: "No Announcements Yet"
							}
							description={
								filter === "unread"
									? "You've read all announcements. Check back later for updates!"
									: "New announcements will appear here when available."
							}
							action={
								filter === "unread" && (
									<Button
										type="button"
										variant="outline"
										onClick={() => onFilterChange("all")}
									>
										View All Announcements
									</Button>
								)
							}
						/>
					</Card>
				) : (
					filteredAnnouncements.map((announcement) => (
						<AnnouncementCard
							key={announcement.id}
							announcement={announcement}
							onMarkAsRead={onMarkAsRead}
							onClick={() => onAnnouncementClick(announcement)}
						/>
					))
				)}
			</div>
		</div>
	);
}
