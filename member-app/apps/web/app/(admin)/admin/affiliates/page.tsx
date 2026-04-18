"use client";

import type { AffiliateWithMetrics } from "@repo/api/modules/admin/types";
import { logger } from "@repo/logs";
import { AffiliateDetailSheet } from "@saas/admin/component/affiliates/AffiliateDetailSheet";
import { BackfillReferralDialog } from "@saas/admin/component/affiliates/BackfillReferralDialog";
import { DateRangeSelect } from "@saas/admin/component/DateRangeSelect";
import { AffiliateStatusBadge } from "@saas/admin/component/StatusBadges";
import { AddUserDialog } from "@saas/admin/component/users/AddUserDialog";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useDateRangeFilter } from "@saas/admin/hooks/use-date-range-filter";
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search";
import {
	exportToCSV,
	formatCurrency,
	formatCurrencyRounded,
	formatDate,
	formatRelativeTime,
	getInitials,
} from "@saas/admin/lib/subscription-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@ui/components/tooltip";
import { useIsMobile } from "@ui/hooks/use-mobile";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	AlertTriangle,
	ChevronDown,
	Download,
	HelpCircle,
	Link2,
	RefreshCw,
	Search,
	TrendingUp,
	Users,
	X,
} from "@/modules/ui/icons";

export default function AffiliatesPage() {
	const isMobile = useIsMobile();
	const { searchQuery, setSearchQuery, debouncedQuery } =
		useDebouncedSearch();
	const [statusFilter, setStatusFilter] = useState<
		"all" | "active" | "disabled" | "suspicious"
	>("all");
	const [selectedAffiliate, setSelectedAffiliate] =
		useState<AffiliateWithMetrics | null>(null);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [dismissedBanner, setDismissedBanner] = useState(false);
	const [earningsFilter, setEarningsFilter] = useState<
		"all" | "0-100" | "100-500" | "500-1000" | "1000+"
	>("all");
	const [conversionsFilter, setConversionsFilter] = useState<
		"all" | "5+" | "10+" | "25+" | "50+"
	>("all");
	const [syncing, setSyncing] = useState(false);
	const [lastSync, setLastSync] = useState<any>(null);
	const [quickFilter, setQuickFilter] = useState<
		"all" | "needs-attention" | "new" | "no-account"
	>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const [addUserOpen, setAddUserOpen] = useState(false);
	const [affiliateToCreate, setAffiliateToCreate] = useState<{
		email: string;
		name: string;
		rewardfulId: string;
	} | null>(null);
	const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
	const [backfillReferralOpen, setBackfillReferralOpen] = useState(false);

	const {
		dateRange,
		setDateRange,
		customDateLabel,
		isWithinDateRange,
		handleCustomRangeApply,
		clearDateRange,
	} = useDateRangeFilter();

	// Fetch data
	const { data, isLoading, isError, error, refetch } = useQuery({
		...orpc.admin.affiliates.list.queryOptions({
			input: {
				searchTerm: debouncedQuery || undefined,
				status: statusFilter === "all" ? undefined : statusFilter,
				quickFilter: (quickFilter === "all"
					? undefined
					: quickFilter) as
					| "needs-attention"
					| "new"
					| "no-account"
					| undefined,
				page: currentPage,
				limit: 50,
			},
		}),
		placeholderData: (prev) => prev,
	});

	const affiliates = data?.affiliates || [];
	const stats = data?.stats || {
		totalAffiliates: 0,
		activeAffiliates: 0,
		noAccountCount: 0,
		totalClicks: 0,
		totalConversions: 0,
		totalCommissions: { pending: 0, due: 0, paid: 0, total: 0 },
		grossRevenue: 0,
	};

	// Check localStorage for banner dismissal
	useEffect(() => {
		const dismissed = localStorage.getItem(
			"affiliates-beta-banner-dismissed",
		);
		if (dismissed) {
			const dismissedDate = new Date(dismissed);
			const daysSinceDismissed =
				(Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
			if (daysSinceDismissed < 7) {
				setDismissedBanner(true);
			} else {
				localStorage.removeItem("affiliates-beta-banner-dismissed");
			}
		}
	}, []);

	const handleDismissBanner = () => {
		setDismissedBanner(true);
		localStorage.setItem(
			"affiliates-beta-banner-dismissed",
			new Date().toISOString(),
		);
	};

	// Sync handler
	const handleSync = async (forceRefresh = false) => {
		setSyncing(true);
		try {
			const result = await orpcClient.admin.rewardful.sync({
				forceRefresh,
			});
			setLastSync(result);
			toast.success(
				`Synced ${result.syncResults.synced} affiliates successfully`,
			);
			refetch(); // Refresh affiliate list
		} catch (error) {
			toast.error("Sync failed");
			logger.error("Sync error", { error });
		} finally {
			setSyncing(false);
		}
	};

	// Per-affiliate sync handler
	const handleSyncAffiliate = async (
		rewardfulId: string,
		affiliateName: string,
	) => {
		try {
			await orpcClient.admin.rewardful.syncSingle({ rewardfulId });
			toast.success(`Refreshed data for ${affiliateName}`);
			refetch();
		} catch (error) {
			toast.error(`Failed to refresh ${affiliateName}`);
			logger.error("Sync error", { error, affiliateName });
		}
	};

	// Handler for account creation
	const handleCreateAccount = (affiliate: AffiliateWithMetrics) => {
		setAffiliateToCreate({
			email: affiliate.email,
			name: affiliate.name,
			rewardfulId: affiliate.rewardfulId,
		});
		setAddUserOpen(true);
	};

	// Handler for unlinking affiliate from user
	const handleUnlinkAffiliate = async (
		rewardfulId: string,
		affiliateName: string,
		userEmail: string,
	) => {
		if (
			!confirm(
				`Are you sure you want to unlink "${affiliateName}" from user ${userEmail}?\n\nThis will remove the connection in your database but will NOT delete the affiliate from Rewardful. The user can re-link their account later.`,
			)
		) {
			return;
		}

		setUnlinkingId(rewardfulId);
		try {
			await orpcClient.admin.rewardful.unlinkFromUser({ rewardfulId });
			toast.success(`Unlinked ${affiliateName} from ${userEmail}`);
			refetch();
		} catch (error) {
			toast.error(
				`Failed to unlink affiliate: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
			logger.error("Unlink error", { error, rewardfulId });
		} finally {
			setUnlinkingId(null);
		}
	};

	// Search shortcut handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
				e.preventDefault();
				const input = document.getElementById(
					"affiliates-search-input",
				) as HTMLInputElement;
				input?.focus();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Reset page when search query changes
	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedQuery]);

	// Client-side filters layered on top of server results
	const filteredAndSorted = useMemo(() => {
		let filtered = affiliates;

		// Date range filter (join date)
		filtered = filtered.filter((a) => isWithinDateRange(a.joinDate));

		// Earnings range filter
		if (earningsFilter !== "all") {
			filtered = filtered.filter((a) => {
				const earnings = a.totalEarnings;
				switch (earningsFilter) {
					case "0-100":
						return earnings >= 0 && earnings < 100;
					case "100-500":
						return earnings >= 100 && earnings < 500;
					case "500-1000":
						return earnings >= 500 && earnings < 1000;
					case "1000+":
						return earnings >= 1000;
					default:
						return true;
				}
			});
		}

		// Conversions filter
		if (conversionsFilter !== "all") {
			const min = Number.parseInt(conversionsFilter, 10);
			filtered = filtered.filter((a) => a.conversions >= min);
		}

		return filtered;
	}, [affiliates, earningsFilter, conversionsFilter, isWithinDateRange]);

	// Export CSV
	const handleExportCSV = useCallback(() => {
		exportToCSV(
			filteredAndSorted,
			[
				"Name",
				"Email",
				"Status",
				"Join Date",
				"Total Clicks",
				"Conversions",
				"Conversion Rate",
				"Total Earnings",
				"Pending Earnings",
				"Due Earnings",
				"Paid Earnings",
				"Rewardful ID",
			],
			(affiliate) => [
				affiliate.name,
				affiliate.email,
				affiliate.status,
				formatDate(affiliate.joinDate),
				affiliate.totalClicks.toString(),
				affiliate.conversions.toString(),
				`${affiliate.conversionRate}%`,
				`$${affiliate.totalEarnings.toFixed(2)}`,
				`$${affiliate.pendingEarnings.toFixed(2)}`,
				`$${affiliate.dueEarnings.toFixed(2)}`,
				`$${affiliate.paidEarnings.toFixed(2)}`,
				affiliate.rewardfulId,
			],
			"affiliates-export",
		);
		toast.success(
			`Exported ${filteredAndSorted.length} affiliate${filteredAndSorted.length !== 1 ? "s" : ""}`,
		);
	}, [filteredAndSorted]);

	// Network conversion rate: total conversions ÷ total clicks
	const networkConversionRate =
		stats.totalClicks > 0
			? ((stats.totalConversions / stats.totalClicks) * 100).toFixed(1)
			: "0.0";

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Affiliates"
				description="The affiliates management page requires a desktop screen to function properly."
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

	return (
		<div className="space-y-6 p-6">
			{/* Beta Banner */}
			{!dismissedBanner && (
				<Card className="border-amber-500/20 bg-amber-500/10">
					<div className="flex items-start gap-3 p-4">
						<AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
						<div className="flex-1">
							<p className="text-sm font-medium text-amber-500">
								This feature is in beta
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Data is synced from Rewardful API (cached for 5
								minutes). All affiliate actions should be
								completed in the Rewardful dashboard. This page
								is for admin validation only.
							</p>
						</div>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleDismissBanner}
							className="shrink-0"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</Card>
			)}

			{/* Page Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-balance">
						Affiliates
					</h1>
					<p className="mt-2 text-pretty text-muted-foreground">
						Track and manage affiliate performance from Rewardful
					</p>
					{(lastSync?.timestamp || data?.lastSync) && (
						<p className="mt-1 text-xs text-muted-foreground">
							{lastSync?.timestamp ? (
								<>
									Last synced:{" "}
									{new Date(
										lastSync.timestamp,
									).toLocaleTimeString()}{" "}
									({lastSync.syncResults.synced} affiliates,{" "}
									{lastSync.syncResults.errors} errors)
								</>
							) : data?.lastSync ? (
								<>
									Last synced:{" "}
									{new Date(
										data.lastSync,
									).toLocaleTimeString()}
								</>
							) : null}
						</p>
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						onClick={() => handleSync(false)}
						disabled={syncing}
						variant="outline"
						size="sm"
					>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
						/>
						{syncing ? "Syncing..." : "Sync Rewardful"}
					</Button>
					<Button
						onClick={() => setBackfillReferralOpen(true)}
						variant="outline"
						size="sm"
					>
						<Link2 className="mr-2 h-4 w-4" />
						Backfill referrals
					</Button>
					<Button
						onClick={handleExportCSV}
						variant="outline"
						size="sm"
					>
						<Download className="mr-2 h-4 w-4" />
						Export
					</Button>
				</div>
			</div>

			{/* Stats Cards */}
			<TooltipProvider>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{/* Affiliates — label updates per tab */}
					<Card className="border-border/60 transition-colors duration-150 hover:border-border">
						<div className="p-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
									<Users className="h-6 w-6 text-blue-500" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium text-muted-foreground">
										{quickFilter === "needs-attention"
											? "Needs Attention"
											: quickFilter === "new"
												? "New This Month"
												: quickFilter === "no-account"
													? "No Account"
													: "Affiliates"}
									</p>
									<p className="text-2xl font-bold tabular-nums">
										{stats.totalAffiliates.toLocaleString(
											"en-US",
										)}
									</p>
									<div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
										{quickFilter === "all" ||
										!quickFilter ? (
											<>
												<span className="text-xs text-muted-foreground">
													{stats.activeAffiliates.toLocaleString(
														"en-US",
													)}{" "}
													active
												</span>
												{stats.totalAffiliates -
													stats.activeAffiliates >
													0 && (
													<span className="text-xs text-red-400">
														·{" "}
														{(
															stats.totalAffiliates -
															stats.activeAffiliates
														).toLocaleString(
															"en-US",
														)}{" "}
														disabled/suspicious
													</span>
												)}
												{stats.noAccountCount > 0 && (
													<span className="text-xs text-amber-500">
														·{" "}
														{stats.noAccountCount.toLocaleString(
															"en-US",
														)}{" "}
														without accounts
													</span>
												)}
											</>
										) : (
											<span className="text-xs text-muted-foreground">
												in this view
											</span>
										)}
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Total Conversions */}
					<Card className="border-border/60 transition-colors duration-150 hover:border-border">
						<div className="p-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500/10">
									<TrendingUp className="h-6 w-6 text-green-500" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium text-muted-foreground">
										Total Conversions
									</p>
									<p className="text-2xl font-bold tabular-nums">
										{stats.totalConversions.toLocaleString(
											"en-US",
										)}
									</p>
									<div className="flex items-center gap-1">
										<p className="text-xs text-muted-foreground">
											{networkConversionRate}% network
											rate
										</p>
										<Tooltip>
											<TooltipTrigger asChild>
												<HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
											</TooltipTrigger>
											<TooltipContent className="max-w-56 text-xs">
												Total purchases ÷ total clicks
												across all affiliate links.
												Measures how effectively the
												whole program converts traffic.
											</TooltipContent>
										</Tooltip>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Total Commissions */}
					<Card className="border-border/60 transition-colors duration-150 hover:border-border">
						<div className="p-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10">
									<TrendingUp className="h-6 w-6 text-[#FF6B35]" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium text-muted-foreground">
										Total Commissions
									</p>
									<p className="text-2xl font-bold tabular-nums">
										{formatCurrencyRounded(
											stats.totalCommissions.total,
										)}
									</p>
									<div className="flex items-center gap-1">
										{stats.totalCommissions.due > 0 ? (
											<p className="text-xs text-amber-500">
												{formatCurrencyRounded(
													stats.totalCommissions.due,
												)}{" "}
												due for payout
											</p>
										) : (
											<p className="text-xs text-muted-foreground">
												All paid up
											</p>
										)}
										<Tooltip>
											<TooltipTrigger asChild>
												<HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
											</TooltipTrigger>
											<TooltipContent className="max-w-56 text-xs">
												Total commissions earned across
												all affiliates. "Due for payout"
												means Rewardful has approved
												these commissions and they are
												ready to be disbursed.
											</TooltipContent>
										</Tooltip>
									</div>
								</div>
							</div>
						</div>
					</Card>

					{/* Gross Revenue */}
					<Card className="border-border/60 transition-colors duration-150 hover:border-border">
						<div className="p-6">
							<div className="flex items-center gap-4">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
									<TrendingUp className="h-6 w-6 text-purple-500" />
								</div>
								<div className="min-w-0">
									<p className="text-sm font-medium text-muted-foreground">
										Gross Revenue
									</p>
									<p className="text-2xl font-bold tabular-nums">
										{formatCurrencyRounded(
											stats.grossRevenue,
										)}
									</p>
									<div className="flex items-center gap-1">
										<p className="text-xs text-muted-foreground">
											{stats.totalCommissions.total > 0 &&
											stats.grossRevenue > 0
												? `${((stats.totalCommissions.total / stats.grossRevenue) * 100).toFixed(1)}% paid as commissions`
												: "Revenue driven by affiliates"}
										</p>
										<Tooltip>
											<TooltipTrigger asChild>
												<HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
											</TooltipTrigger>
											<TooltipContent className="max-w-56 text-xs">
												Total customer payments
												attributed to affiliate
												referrals. Updates to reflect
												the active tab.
											</TooltipContent>
										</Tooltip>
									</div>
								</div>
							</div>
						</div>
					</Card>
				</div>
			</TooltipProvider>

			{/* View tabs */}
			<div className="border-b border-border">
				<div className="flex gap-0">
					{(
						[
							{
								key: "all",
								label: "All Affiliates",
								icon: null,
								title: "All affiliates sorted by earnings",
							},
							{
								key: "needs-attention",
								label: "Needs Attention",
								icon: AlertTriangle,
								title: "Affiliates with 10+ clicks but zero conversions — worth reaching out",
							},
							{
								key: "new",
								label: "New Affiliates",
								icon: Users,
								title: "Affiliates who joined in the last 30 days",
							},
							{
								key: "no-account",
								label: "No Account",
								icon: AlertCircle,
								title: "Affiliates in Rewardful with no app account — create accounts to give them platform access",
								count: stats.noAccountCount,
							},
						] as const
					).map(({ key, label, icon: Icon, title, ...rest }) => {
						const count =
							"count" in rest
								? (rest as { count?: number }).count
								: undefined;
						return (
							<button
								key={key}
								type="button"
								title={title}
								onClick={() => {
									setQuickFilter(key);
									setCurrentPage(1);
								}}
								className={[
									"relative flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
									quickFilter === key
										? "border-[#FF6B35] text-foreground"
										: "border-transparent text-muted-foreground hover:text-foreground",
								].join(" ")}
							>
								{Icon && <Icon className="h-3.5 w-3.5" />}
								{label}
								{count != null && count > 0 && (
									<span
										className={[
											"ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
											quickFilter === key
												? "bg-[#FF6B35]/20 text-[#FF6B35]"
												: "bg-muted text-muted-foreground",
										].join(" ")}
									>
										{count.toLocaleString("en-US")}
									</span>
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Search and Filters */}
			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative max-w-md flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by name or email... (Press / to focus)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9 pr-9"
						id="affiliates-search-input"
					/>
					{searchQuery && (
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSearchQuery("")}
							className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>

				<div className="flex flex-wrap gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="pointer-events-none opacity-40 cursor-not-allowed">
								<DateRangeSelect
									value={dateRange}
									customLabel={customDateLabel}
									onChange={setDateRange}
									onCustomRangeApply={handleCustomRangeApply}
									onClear={clearDateRange}
								/>
							</div>
						</TooltipTrigger>
						<TooltipContent className="max-w-48 text-xs">
							Date-filtered commission data coming soon
						</TooltipContent>
					</Tooltip>

					<Select
						value={earningsFilter}
						onValueChange={(value: any) => {
							setEarningsFilter(value);
							setCurrentPage(1);
						}}
					>
						<SelectTrigger className="w-full bg-transparent sm:w-auto">
							Earnings Range
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="all">All Earnings</SelectItem>
							<SelectItem value="0-100">$0 – $100</SelectItem>
							<SelectItem value="100-500">$100 – $500</SelectItem>
							<SelectItem value="500-1000">
								$500 – $1,000
							</SelectItem>
							<SelectItem value="1000+">$1,000+</SelectItem>
						</SelectContent>
					</Select>

					<Select
						value={conversionsFilter}
						onValueChange={(value: any) => {
							setConversionsFilter(value);
							setCurrentPage(1);
						}}
					>
						<SelectTrigger className="w-full bg-transparent sm:w-auto">
							Conversions
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="all">Any Conversions</SelectItem>
							<SelectItem value="5">5+</SelectItem>
							<SelectItem value="10">10+</SelectItem>
							<SelectItem value="25">25+</SelectItem>
							<SelectItem value="50">50+</SelectItem>
						</SelectContent>
					</Select>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								className="w-full bg-transparent sm:w-auto"
							>
								Status:{" "}
								{statusFilter === "all"
									? "All"
									: statusFilter.charAt(0).toUpperCase() +
										statusFilter.slice(1)}
								<ChevronDown className="ml-2 h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("all");
									setCurrentPage(1);
								}}
							>
								All
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("active");
									setCurrentPage(1);
								}}
							>
								Active
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("disabled");
									setCurrentPage(1);
								}}
							>
								Disabled
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									setStatusFilter("suspicious");
									setCurrentPage(1);
								}}
							>
								Suspicious
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Affiliates Table */}
			<Card>
				<div className="overflow-x-auto">
					{isLoading ? (
						<div className="flex items-center justify-center p-12">
							<svg
								className="h-8 w-8 animate-spin text-primary"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								role="img"
								aria-label="Loading"
							>
								<title>Loading</title>
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
						</div>
					) : (
						<table className="w-full">
							<thead className="border-b border-border">
								<tr>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Affiliate Info
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Performance
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Status
									</th>
									<th className="p-4 text-left text-sm font-medium text-muted-foreground">
										Actions
									</th>
								</tr>
							</thead>
							<tbody>
								{filteredAndSorted.length === 0 ? (
									<tr>
										<td
											colSpan={4}
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
											) : earningsFilter !== "all" ||
												conversionsFilter !== "all" ||
												quickFilter !== "all" ||
												statusFilter !== "all" ||
												dateRange !== "all-time" ? (
												<div className="flex flex-col items-center gap-3">
													<Search className="h-12 w-12 text-muted-foreground" />
													<p className="font-medium text-muted-foreground">
														No affiliates match
														these filters
													</p>
													<p className="text-sm text-muted-foreground">
														Try adjusting your
														filters or clearing them
														to see more results
													</p>
													<Button
														size="sm"
														variant="outline"
														onClick={() => {
															setQuickFilter(
																"all",
															);
															setEarningsFilter(
																"all",
															);
															setConversionsFilter(
																"all",
															);
															setStatusFilter(
																"all",
															);
															clearDateRange();
															setSearchQuery("");
															setCurrentPage(1);
														}}
													>
														Clear all filters
													</Button>
												</div>
											) : affiliates.length === 0 ? (
												<div className="flex flex-col items-center gap-3">
													<Users className="h-12 w-12 text-muted-foreground" />
													<p className="font-medium text-muted-foreground">
														No affiliates found
													</p>
													<p className="text-sm text-muted-foreground">
														Click "Sync Rewardful"
														to load affiliate data
														from Rewardful
													</p>
												</div>
											) : (
												<div className="flex flex-col items-center gap-3">
													<Users className="h-12 w-12 text-muted-foreground" />
													<p className="font-medium text-muted-foreground">
														No affiliates to display
													</p>
												</div>
											)}
										</td>
									</tr>
								) : (
									filteredAndSorted.map((affiliate) => (
										<tr
											key={affiliate.id}
											className="cursor-pointer border-b border-border transition-all duration-150 hover:bg-muted/50"
											onClick={() => {
												setSelectedAffiliate(affiliate);
												setSheetOpen(true);
											}}
										>
											<td className="p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35]/10 font-medium text-[#FF6B35]">
														{getInitials(
															affiliate.name,
														)}
													</div>
													<div>
														<p className="text-sm font-medium">
															{affiliate.name}
														</p>
														<p className="text-xs text-muted-foreground">
															{affiliate.email}
														</p>
														<p className="text-xs text-muted-foreground">
															Joined{" "}
															{formatDate(
																affiliate.joinDate,
															)}
														</p>
													</div>
												</div>
											</td>
											<td className="p-4">
												<div className="space-y-1">
													<div className="flex items-center gap-2 text-sm">
														<span className="text-muted-foreground">
															Clicks:
														</span>
														<span className="tabular-nums font-medium">
															{affiliate.totalClicks.toLocaleString()}
														</span>
													</div>
													<div className="flex items-center gap-2 text-sm">
														<span className="text-muted-foreground">
															Conversions:
														</span>
														<span className="tabular-nums font-medium">
															{
																affiliate.conversions
															}{" "}
															(
															{
																affiliate.conversionRate
															}
															%)
														</span>
													</div>
													<div className="flex items-center gap-2 text-sm">
														<span className="text-muted-foreground">
															Earnings:
														</span>
														<span className="tabular-nums font-medium text-[#FF6B35]">
															{formatCurrency(
																affiliate.totalEarnings,
															)}
														</span>
													</div>
												</div>
											</td>
											<td className="p-4">
												<div className="space-y-2">
													<div className="flex items-center gap-2">
														<AffiliateStatusBadge
															status={
																affiliate.status
															}
														/>
														{!affiliate.hasUserAccount && (
															<Badge className="border-red-500/30 bg-red-500/10 text-xs text-red-500">
																No User
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground">
														{affiliate.lastSyncAt
															? `Synced ${formatRelativeTime(affiliate.lastSyncAt)}`
															: "Never synced"}
													</p>
												</div>
											</td>
											<td className="p-4">
												<Button
													size="sm"
													variant="ghost"
													onClick={(e) => {
														e.stopPropagation();
														setSelectedAffiliate(
															affiliate,
														);
														setSheetOpen(true);
													}}
													className="h-8 w-8 p-0"
													title="View details"
												>
													<ChevronDown className="h-4 w-4 -rotate-90" />
												</Button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					)}
				</div>

				{/* Pagination Controls */}
				{!isLoading && filteredAndSorted.length > 0 && (
					<div className="flex flex-col gap-4 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="text-sm text-muted-foreground">
							Showing{" "}
							<span className="font-medium text-foreground">
								{((data?.page || 1) - 1) * (data?.limit || 50) +
									1}
							</span>{" "}
							to{" "}
							<span className="font-medium text-foreground">
								{Math.min(
									(data?.page || 1) * (data?.limit || 50),
									data?.total || 0,
								)}
							</span>{" "}
							of{" "}
							<span className="font-medium text-foreground">
								{data?.total || 0}
							</span>{" "}
							affiliates
						</div>

						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setCurrentPage((prev) =>
										Math.max(1, prev - 1),
									);
									window.scrollTo({
										top: 0,
										behavior: "smooth",
									});
								}}
								disabled={currentPage === 1}
							>
								Previous
							</Button>

							<div className="flex items-center gap-1">
								{/* Show page numbers */}
								{Array.from(
									{
										length: Math.ceil(
											(data?.total || 0) /
												(data?.limit || 50),
										),
									},
									(_, i) => i + 1,
								)
									.filter((pageNum) => {
										const totalPages = Math.ceil(
											(data?.total || 0) /
												(data?.limit || 50),
										);
										// Show first, last, current, and surrounding pages
										return (
											pageNum === 1 ||
											pageNum === totalPages ||
											Math.abs(pageNum - currentPage) <= 1
										);
									})
									.map((pageNum, idx, arr) => (
										<React.Fragment key={pageNum}>
											{idx > 0 &&
												arr[idx - 1] !==
													pageNum - 1 && (
													<span className="px-2 text-muted-foreground">
														...
													</span>
												)}
											<Button
												variant={
													pageNum === currentPage
														? "primary"
														: "outline"
												}
												size="sm"
												onClick={() => {
													setCurrentPage(pageNum);
													window.scrollTo({
														top: 0,
														behavior: "smooth",
													});
												}}
												className="w-10"
											>
												{pageNum}
											</Button>
										</React.Fragment>
									))}
							</div>

							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setCurrentPage((prev) =>
										Math.min(
											Math.ceil(
												(data?.total || 0) /
													(data?.limit || 50),
											),
											prev + 1,
										),
									);
									window.scrollTo({
										top: 0,
										behavior: "smooth",
									});
								}}
								disabled={
									currentPage >=
									Math.ceil(
										(data?.total || 0) /
											(data?.limit || 50),
									)
								}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</Card>

			<AffiliateDetailSheet
				affiliate={selectedAffiliate}
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				onSync={(rewardfulId, name) =>
					handleSyncAffiliate(rewardfulId, name)
				}
				onUnlink={(rewardfulId, name, email) =>
					handleUnlinkAffiliate(rewardfulId, name, email)
				}
				onCreateAccount={(affiliate) => handleCreateAccount(affiliate)}
				unlinkingId={unlinkingId}
			/>

			<BackfillReferralDialog
				open={backfillReferralOpen}
				onOpenChange={setBackfillReferralOpen}
			/>

			{/* Add User Dialog */}
			<AddUserDialog
				open={addUserOpen}
				onOpenChange={(open) => {
					setAddUserOpen(open);
					if (!open) {
						setAffiliateToCreate(null);
						refetch(); // Refresh list after account creation
					}
				}}
				prefilledData={
					affiliateToCreate
						? {
								email: affiliateToCreate.email,
								name: affiliateToCreate.name,
								affiliateContext: {
									rewardfulId: affiliateToCreate.rewardfulId,
									isAffiliate: true,
								},
							}
						: undefined
				}
			/>
		</div>
	);
}
