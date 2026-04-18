"use client";

import type { Announcement } from "@repo/api/modules/admin/types";
import { CreateAnnouncementDialog } from "@saas/admin/component/announcements/CreateAnnouncementDialog";
import { DeleteAnnouncementDialog } from "@saas/admin/component/announcements/DeleteAnnouncementDialog";
import { ViewStatsDialog } from "@saas/admin/component/announcements/ViewStatsDialog";
import {
	AnnouncementStatusBadge,
	AnnouncementTypeBadge,
} from "@saas/admin/component/StatusBadges";
import { StatsSkeleton } from "@saas/admin/component/skeletons/StatsSkeleton";
import { TableSkeleton } from "@saas/admin/component/skeletons/TableSkeleton";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search";
import {
	exportToCSV,
	formatRelativeTime,
} from "@saas/admin/lib/subscription-utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import { useIsMobile } from "@ui/hooks/use-mobile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	BarChart2,
	Bell,
	Calendar,
	Copy,
	Download,
	Edit,
	Eye,
	MessageSquare,
	MoreVertical,
	PartyPopper,
	Plus,
	RefreshCw,
	Search,
	Settings,
	Star,
	Trash2,
	Wrench,
	X,
} from "@/modules/ui/icons";

// Helper functions
const getTypeIcon = (type: string) => {
	const icons: Record<string, any> = {
		welcome: PartyPopper,
		feature: Star,
		event: Calendar,
		maintenance: Wrench,
		community: MessageSquare,
	};
	return icons[type] || Bell;
};

const _getTypeColor = (type: string) => {
	const colors: Record<string, string> = {
		welcome: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		feature: "bg-purple-500/10 text-purple-500 border-purple-500/20",
		event: "bg-amber-500/10 text-amber-500 border-amber-500/20",
		maintenance: "bg-red-500/10 text-red-500 border-red-500/20",
		community: "bg-green-500/10 text-green-500 border-green-500/20",
	};
	return colors[type] || "bg-blue-500/10 text-blue-500 border-blue-500/20";
};

const getPriorityIndicator = (priority: string) => {
	if (priority === "urgent") {
		return (
			<span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />
		);
	}
	if (priority === "important") {
		return (
			<span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
		);
	}
	return (
		<span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
	);
};

export default function AnnouncementsPage() {
	const isMobile = useIsMobile();
	const { searchQuery, setSearchQuery, debouncedQuery } =
		useDebouncedSearch();
	const [filterStatus, setFilterStatus] = useState<
		"all" | "published" | "draft"
	>("all");
	const [filterType, setFilterType] = useState<
		"all" | "welcome" | "feature" | "event" | "maintenance" | "community"
	>("all");
	const [filterPriority, setFilterPriority] = useState<
		"all" | "normal" | "important" | "urgent"
	>("all");
	const [sortColumn, setSortColumn] = useState<"views" | "created" | null>(
		null,
	);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [editingAnnouncement, setEditingAnnouncement] =
		useState<Announcement | null>(null);
	const [viewStatsAnnouncement, setViewStatsAnnouncement] =
		useState<Announcement | null>(null);
	const [deletingAnnouncement, setDeletingAnnouncement] =
		useState<Announcement | null>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Fetch data
	const { data, isLoading, isError, error, refetch } = useQuery(
		orpc.admin.announcements.list.queryOptions({
			input: {
				searchTerm: debouncedQuery || undefined,
				status: filterStatus === "all" ? undefined : filterStatus,
				type: filterType === "all" ? undefined : filterType,
				priority: filterPriority === "all" ? undefined : filterPriority,
			},
		}),
	);

	const announcements = data?.announcements || [];
	const stats = data?.stats || {
		total: 0,
		published: 0,
		draft: 0,
		totalViews: 0,
	};

	// Search shortcut handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				document.activeElement !== searchInputRef.current
			) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Sort data
	const sortedAnnouncements = useMemo(() => {
		if (!sortColumn) {
			return announcements;
		}

		return [...announcements].sort((a, b) => {
			const aValue =
				sortColumn === "views"
					? a.views
					: new Date(a.createdAt).getTime();
			const bValue =
				sortColumn === "views"
					? b.views
					: new Date(b.createdAt).getTime();

			if (sortDirection === "asc") {
				return aValue > bValue ? 1 : -1;
			}
			return aValue < bValue ? 1 : -1;
		});
	}, [announcements, sortColumn, sortDirection]);

	const handleDuplicateAnnouncement = useCallback(
		(announcement: Announcement) => {
			setEditingAnnouncement({
				...announcement,
				id: `ann_${Date.now()}`,
				title: `${announcement.title} (Copy)`,
				published: false,
				views: 0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});
			setIsCreateDialogOpen(true);
		},
		[],
	);

	const handleExportCSV = useCallback(() => {
		exportToCSV(
			sortedAnnouncements,
			[
				"Title",
				"Type",
				"Priority",
				"Status",
				"Author",
				"Views",
				"Created Date",
				"Updated Date",
			],
			(announcement) => [
				announcement.title,
				announcement.type,
				announcement.priority,
				announcement.published ? "Published" : "Draft",
				announcement.author,
				announcement.views.toString(),
				new Date(announcement.createdAt).toLocaleDateString(),
				new Date(announcement.updatedAt).toLocaleDateString(),
			],
			"announcements-export",
		);
		toast.success(
			`Exported ${sortedAnnouncements.length} announcement${sortedAnnouncements.length !== 1 ? "s" : ""}`,
		);
	}, [sortedAnnouncements]);

	const handleManageSuccess = useCallback(() => {
		refetch();
	}, [refetch]);

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Announcements"
				description="The announcements management page requires a desktop screen to function properly."
			/>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center py-12 px-4">
				<AlertCircle className="h-12 w-12 text-destructive mb-4" />
				<h3 className="font-semibold text-lg">Failed to load data</h3>
				<p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
					{error instanceof Error
						? error.message
						: "An unexpected error occurred. Please try again."}
				</p>
				<Button onClick={() => refetch()} className="mt-4">
					<RefreshCw className="h-4 w-4 mr-2" />
					Try Again
				</Button>
			</div>
		);
	}

	const handleSort = (column: "views" | "created") => {
		if (sortColumn === column) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			setSortDirection("desc");
		}
	};

	const clearFilters = () => {
		setFilterStatus("all");
		setFilterType("all");
		setFilterPriority("all");
		setSearchQuery("");
	};

	const hasActiveFilters =
		filterStatus !== "all" ||
		filterType !== "all" ||
		filterPriority !== "all" ||
		searchQuery;

	const SortIcon = ({ column }: { column: string }) => {
		if (sortColumn !== column) {
			return null;
		}
		return sortDirection === "asc" ? (
			<ArrowUp className="ml-1 inline-block h-3 w-3" aria-hidden="true" />
		) : (
			<ArrowDown
				className="ml-1 inline-block h-3 w-3"
				aria-hidden="true"
			/>
		);
	};

	return (
		<div className="space-y-6 p-6">
			{/* Header Section */}
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight text-balance">
							Announcements
						</h1>
						<p className="mt-1 text-muted-foreground">
							Manage platform announcements shown to all users
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={() =>
								(window.location.href =
									"/admin/announcements/global")
							}
						>
							<Settings className="h-4 w-4 mr-2" />
							Global Announcements
						</Button>
						<Button
							onClick={() => {
								setEditingAnnouncement(null);
								setIsCreateDialogOpen(true);
							}}
							className="shrink-0 bg-[#FF6B35] hover:bg-[#FF6B35]/90"
						>
							<Plus className="mr-2 h-4 w-4" />
							Create Announcement
						</Button>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card className="transition-all duration-150 hover:scale-[1.02]">
						<div className="flex items-center gap-3 p-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35]/10">
								<Bell className="h-5 w-5 text-[#FF6B35]" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">
									Total
								</p>
								<p className="text-2xl font-bold">
									{stats.total}
								</p>
							</div>
						</div>
					</Card>

					<Card className="transition-all duration-150 hover:scale-[1.02]">
						<div className="flex items-center gap-3 p-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
								<Eye className="h-5 w-5 text-green-500" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">
									Published
								</p>
								<p className="text-2xl font-bold">
									{stats.published}
								</p>
							</div>
						</div>
					</Card>

					<Card className="transition-all duration-150 hover:scale-[1.02]">
						<div className="flex items-center gap-3 p-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
								<Edit className="h-5 w-5 text-amber-500" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">
									Drafts
								</p>
								<p className="text-2xl font-bold">
									{stats.draft}
								</p>
							</div>
						</div>
					</Card>

					<Card className="transition-all duration-150 hover:scale-[1.02]">
						<div className="flex items-center gap-3 p-4">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
								<BarChart2 className="h-5 w-5 text-blue-500" />
							</div>
							<div>
								<p className="text-sm text-muted-foreground">
									Total Views
								</p>
								<p className="text-2xl font-bold">
									{stats.totalViews.toLocaleString()}
								</p>
							</div>
						</div>
					</Card>
				</div>
			</div>

			{/* Filter Controls Section */}
			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative max-w-md flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder="Search announcements... (Press / to focus)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
					{searchQuery && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 transform p-0"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="min-w-[120px] justify-between bg-transparent"
							>
								Status:{" "}
								{filterStatus === "all"
									? "All"
									: filterStatus.charAt(0).toUpperCase() +
										filterStatus.slice(1)}
								<ArrowUpDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => setFilterStatus("all")}
							>
								<div className="flex items-center gap-2">
									{filterStatus === "all" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									All Status
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterStatus("published")}
							>
								<div className="flex items-center gap-2">
									{filterStatus === "published" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									Published
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterStatus("draft")}
							>
								<div className="flex items-center gap-2">
									{filterStatus === "draft" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									Draft
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="min-w-[120px] justify-between bg-transparent"
							>
								Type:{" "}
								{filterType === "all"
									? "All"
									: filterType.charAt(0).toUpperCase() +
										filterType.slice(1)}
								<ArrowUpDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => setFilterType("all")}
							>
								<div className="flex items-center gap-2">
									{filterType === "all" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									All Types
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterType("welcome")}
							>
								<div className="flex items-center gap-2">
									{filterType === "welcome" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<PartyPopper className="h-3 w-3" />
									Welcome
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterType("feature")}
							>
								<div className="flex items-center gap-2">
									{filterType === "feature" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<Star className="h-3 w-3" />
									Feature
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterType("event")}
							>
								<div className="flex items-center gap-2">
									{filterType === "event" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<Calendar className="h-3 w-3" />
									Event
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterType("maintenance")}
							>
								<div className="flex items-center gap-2">
									{filterType === "maintenance" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<Wrench className="h-3 w-3" />
									Maintenance
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterType("community")}
							>
								<div className="flex items-center gap-2">
									{filterType === "community" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<MessageSquare className="h-3 w-3" />
									Community
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="min-w-[120px] justify-between bg-transparent"
							>
								Priority:{" "}
								{filterPriority === "all"
									? "All"
									: filterPriority.charAt(0).toUpperCase() +
										filterPriority.slice(1)}
								<ArrowUpDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => setFilterPriority("all")}
							>
								<div className="flex items-center gap-2">
									{filterPriority === "all" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									All Priorities
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterPriority("urgent")}
							>
								<div className="flex items-center gap-2">
									{filterPriority === "urgent" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />
									Urgent
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterPriority("important")}
							>
								<div className="flex items-center gap-2">
									{filterPriority === "important" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
									Important
								</div>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setFilterPriority("normal")}
							>
								<div className="flex items-center gap-2">
									{filterPriority === "normal" && (
										<div className="h-2 w-2 rounded-full bg-[#FF6B35]" />
									)}
									<span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500" />
									Normal
								</div>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{hasActiveFilters && (
						<Button
							variant="ghost"
							onClick={clearFilters}
							className="px-3"
						>
							<X className="mr-1 h-4 w-4" />
							Clear
						</Button>
					)}
				</div>
			</div>

			{/* Filter Results Count and Active Filter Badges */}
			{hasActiveFilters && (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm text-muted-foreground">
						Showing {sortedAnnouncements.length} of{" "}
						{announcements.length} announcements
					</p>
					{filterStatus !== "all" && (
						<Badge className="gap-1">
							{filterStatus}
							<X
								className="h-3 w-3 cursor-pointer hover:text-foreground"
								onClick={() => setFilterStatus("all")}
							/>
						</Badge>
					)}
					{filterType !== "all" && (
						<Badge className="gap-1">
							{filterType}
							<X
								className="h-3 w-3 cursor-pointer hover:text-foreground"
								onClick={() => setFilterType("all")}
							/>
						</Badge>
					)}
					{filterPriority !== "all" && (
						<Badge className="gap-1">
							{filterPriority}
							<X
								className="h-3 w-3 cursor-pointer hover:text-foreground"
								onClick={() => setFilterPriority("all")}
							/>
						</Badge>
					)}
				</div>
			)}

			{/* Announcements Table */}
			{isLoading ? (
				<>
					<StatsSkeleton />
					<TableSkeleton rows={5} columns={6} />
				</>
			) : (
				<Card>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="border-b border-border">
								<tr>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Title
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Type
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Status
									</th>
									<th
										className="p-0 text-left text-sm font-medium"
										aria-sort={
											sortColumn === "views"
												? sortDirection === "asc"
													? "ascending"
													: "descending"
												: "none"
										}
									>
										<button
											type="button"
											className="w-full cursor-pointer p-4 text-left text-muted-foreground transition-colors hover:text-foreground"
											onClick={() => handleSort("views")}
										>
											Views <SortIcon column="views" />
										</button>
									</th>
									<th
										className="p-0 text-left text-sm font-medium"
										aria-sort={
											sortColumn === "created"
												? sortDirection === "asc"
													? "ascending"
													: "descending"
												: "none"
										}
									>
										<button
											type="button"
											className="w-full cursor-pointer p-4 text-left text-muted-foreground transition-colors hover:text-foreground"
											onClick={() =>
												handleSort("created")
											}
										>
											Created{" "}
											<SortIcon column="created" />
										</button>
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{sortedAnnouncements.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="py-12 text-center"
										>
											{searchQuery ? (
												<div className="flex flex-col items-center gap-3">
													<Search className="h-12 w-12 text-muted-foreground" />
													<p className="text-muted-foreground">
														No results for "
														{searchQuery}"
													</p>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															setSearchQuery("")
														}
													>
														Clear search
													</Button>
												</div>
											) : (
												<div className="flex flex-col items-center gap-4 py-8">
													<Bell className="h-16 w-16 text-muted-foreground" />
													<div className="text-center space-y-2">
														<h3 className="text-lg font-semibold">
															No announcements yet
														</h3>
														<p className="text-sm text-muted-foreground max-w-md">
															Get started by
															creating your first
															community
															announcement. Share
															updates, features,
															events, and
															important
															information with
															your users.
														</p>
													</div>
													<Button
														onClick={() => {
															setEditingAnnouncement(
																null,
															);
															setIsCreateDialogOpen(
																true,
															);
														}}
														className="bg-[#FF6B35] hover:bg-[#FF6B35]/90"
													>
														<Plus className="mr-2 h-4 w-4" />
														Create Announcement
													</Button>
												</div>
											)}
										</td>
									</tr>
								) : (
									sortedAnnouncements.map(
										(announcement, idx) => {
											const _TypeIcon = getTypeIcon(
												announcement.type,
											);
											return (
												<tr
													key={announcement.id}
													className={`group transition-all duration-150 hover:bg-muted/50 ${
														idx % 2 === 0
															? "bg-muted/20"
															: ""
													}`}
												>
													<td className="p-4">
														<div className="flex items-start gap-2">
															{getPriorityIndicator(
																announcement.priority,
															)}
															<div className="min-w-0">
																<p className="text-sm font-medium">
																	{
																		announcement.title
																	}
																</p>
																<p className="max-w-[300px] truncate text-xs text-muted-foreground">
																	{
																		announcement.contentPreview
																	}
																</p>
															</div>
														</div>
													</td>
													<td className="p-4">
														<AnnouncementTypeBadge
															type={
																announcement.type
															}
														/>
													</td>
													<td className="p-4">
														<AnnouncementStatusBadge
															status={
																announcement.published
																	? "published"
																	: "draft"
															}
														/>
													</td>
													<td className="p-4 text-sm">
														<div className="flex items-center gap-1">
															<Eye className="h-3 w-3 text-muted-foreground" />
															{announcement.views.toLocaleString()}
														</div>
													</td>
													<td className="p-4 text-sm text-muted-foreground">
														{formatRelativeTime(
															announcement.createdAt,
														)}
													</td>
													<td className="p-4">
														<DropdownMenu>
															<DropdownMenuTrigger
																asChild
															>
																<Button
																	size="sm"
																	variant="ghost"
																	className="h-8 w-8 p-0"
																>
																	<MoreVertical className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() => {
																		setEditingAnnouncement(
																			announcement,
																		);
																		setIsCreateDialogOpen(
																			true,
																		);
																	}}
																>
																	<Edit className="mr-2 h-4 w-4" />
																	Edit
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		handleDuplicateAnnouncement(
																			announcement,
																		)
																	}
																>
																	<Copy className="mr-2 h-4 w-4" />
																	Duplicate
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() =>
																		setViewStatsAnnouncement(
																			announcement,
																		)
																	}
																>
																	<BarChart2 className="mr-2 h-4 w-4" />
																	View Stats
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	onClick={() =>
																		setDeletingAnnouncement(
																			announcement,
																		)
																	}
																	className="text-red-500 focus:text-red-500"
																>
																	<Trash2 className="mr-2 h-4 w-4" />
																	Delete
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</td>
												</tr>
											);
										},
									)
								)}
							</tbody>
						</table>
					</div>
				</Card>
			)}

			{/* Buttons Section */}
			<div className="flex gap-2">
				<Button variant="outline" size="sm" onClick={handleExportCSV}>
					<Download className="mr-2 h-4 w-4" />
					Export
				</Button>
				<Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					New Announcement
				</Button>
			</div>

			{/* Dialogs */}
			<CreateAnnouncementDialog
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				initialData={editingAnnouncement || undefined}
				onSuccess={handleManageSuccess}
			/>

			{viewStatsAnnouncement && (
				<ViewStatsDialog
					open={!!viewStatsAnnouncement}
					onOpenChange={(open) =>
						!open && setViewStatsAnnouncement(null)
					}
					announcement={viewStatsAnnouncement}
				/>
			)}

			{deletingAnnouncement && (
				<DeleteAnnouncementDialog
					open={!!deletingAnnouncement}
					onOpenChange={(open) =>
						!open && setDeletingAnnouncement(null)
					}
					announcement={deletingAnnouncement}
					onSuccess={handleManageSuccess}
				/>
			)}
		</div>
	);
}
