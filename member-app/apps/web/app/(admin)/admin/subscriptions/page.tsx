"use client";

import type { SubscriptionWithUser } from "@repo/api/modules/admin/types";
import { DateRangeSelect } from "@saas/admin/component/DateRangeSelect";
import { SubscriptionStatusBadge } from "@saas/admin/component/StatusBadges";
import { StatsSkeleton } from "@saas/admin/component/skeletons/StatsSkeleton";
import { TableSkeleton } from "@saas/admin/component/skeletons/TableSkeleton";
import { ImportStripeDialog } from "@saas/admin/component/subscriptions/ImportStripeDialog";
import { ManageActiveSubscriptionDialog } from "@saas/admin/component/subscriptions/ManageActiveDialog";
import { ManageFreeAccessDialog } from "@saas/admin/component/subscriptions/ManageFreeAccessDialog";
import { ManageTrialDialog } from "@saas/admin/component/subscriptions/ManageTrialDialog";
import { ViewInactiveSubscriptionDialog } from "@saas/admin/component/subscriptions/ViewInactiveDialog";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useDateRangeFilter } from "@saas/admin/hooks/use-date-range-filter";
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search";
import {
	exportToCSV,
	formatCurrency,
	formatDate,
	formatRelativeTime,
} from "@saas/admin/lib/subscription-utils";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Skeleton } from "@ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@ui/components/tooltip";
import { useIsMobile } from "@ui/hooks/use-mobile";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	ArrowDown,
	ArrowUp,
	ChevronDown,
	Clock,
	DollarSign,
	Download,
	Filter,
	Key,
	RefreshCw,
	Search,
	Tag,
	TrendingDown,
	TrendingUp,
	Upload,
	Users,
	X,
} from "@/modules/ui/icons";

type TabType = "active" | "trials" | "free" | "inactive";

export default function SubscriptionsPage() {
	const isMobile = useIsMobile();
	const searchParams = useSearchParams();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<TabType>("active");
	const { searchQuery, setSearchQuery, debouncedQuery } =
		useDebouncedSearch();
	const [autoOpenForUser, setAutoOpenForUser] = useState<string | null>(null);
	const [selectedSubscription, setSelectedSubscription] =
		useState<SubscriptionWithUser | null>(null);
	const [isActiveDialogOpen, setIsActiveDialogOpen] = useState(false);
	const [isTrialDialogOpen, setIsTrialDialogOpen] = useState(false);
	const [isFreeAccessDialogOpen, setIsFreeAccessDialogOpen] = useState(false);
	const [isInactiveDialogOpen, setIsInactiveDialogOpen] = useState(false);
	const [isImportStripeDialogOpen, setIsImportStripeDialogOpen] =
		useState(false);
	const [sortColumn, setSortColumn] = useState<string | null>(null);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
	const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [planTypeFilter, setPlanTypeFilter] = useState<
		"all" | "month" | "year"
	>("all");

	const {
		dateRange,
		setDateRange,
		customDateLabel,
		isWithinDateRange,
		handleCustomRangeApply,
		clearDateRange,
	} = useDateRangeFilter();

	// Fetch data
	const { data, isLoading, isError, error, refetch } = useQuery(
		orpc.admin.subscriptions.overview.queryOptions({
			input: {
				searchTerm: debouncedQuery || undefined,
				filter:
					activeTab === "active"
						? "active"
						: activeTab === "trials"
							? "trial"
							: activeTab === "free"
								? "free"
								: activeTab === "inactive"
									? "inactive"
									: undefined,
			},
		}),
	);

	const stats = data?.stats || {
		mrr: 0,
		arr: 0,
		churnRate: 0,
		activeSubscribers: 0,
		activeTrials: 0,
		freeAccess: 0,
		inactiveSubscriptions: 0,
	};

	const subscriptions = data?.subscriptions || [];

	// Manual sync mutation
	const syncMutation = useMutation(
		orpc.admin.subscriptions.syncStripe.mutationOptions(),
	);

	const handleSyncFromStripe = useCallback(async () => {
		const toastId = toast.loading("Syncing from Stripe...");
		try {
			await syncMutation.mutateAsync({});
			toast.success("Subscription data synced from Stripe", {
				id: toastId,
			});
			refetch();
		} catch (error) {
			toast.error(
				`Failed to sync: ${error instanceof Error ? error.message : "Unknown error"}`,
				{ id: toastId },
			);
		}
	}, [syncMutation, refetch]);

	// Handle URL query params for deep linking from Users page
	useEffect(() => {
		const userParam = searchParams.get("user");
		const manageParam = searchParams.get("manage");

		if (userParam) {
			// Pre-fill the search with the user's email
			setSearchQuery(userParam);

			// If manage=true, set flag to auto-open dialog when data loads
			if (manageParam === "true") {
				setAutoOpenForUser(userParam);
			}

			// Clear the URL params after reading them
			router.replace("/admin/subscriptions", { scroll: false });
		}
	}, [searchParams, setSearchQuery, router]);

	// Auto-open dialog when data loads and we have a user to manage
	useEffect(() => {
		if (autoOpenForUser && subscriptions.length > 0 && !isLoading) {
			const subscription = subscriptions.find(
				(s) =>
					s.userEmail.toLowerCase() === autoOpenForUser.toLowerCase(),
			);
			if (subscription) {
				setSelectedSubscription(subscription);
				// Open the appropriate dialog based on status
				if (subscription.status === "active") {
					setIsActiveDialogOpen(true);
				} else if (subscription.status === "trialing") {
					setIsTrialDialogOpen(true);
				} else if (subscription.productId === "manual-override") {
					setIsFreeAccessDialogOpen(true);
				}
			}
			setAutoOpenForUser(null); // Clear after handling
		}
	}, [autoOpenForUser, subscriptions, isLoading]);

	// Filter subscriptions by tab
	const filteredSubscriptions = useMemo(() => {
		let filtered = subscriptions;

		// Filter by plan type
		if (planTypeFilter !== "all") {
			filtered = filtered.filter((sub) => {
				if (planTypeFilter === "month") {
					return sub.plan.includes("Monthly");
				}
				if (planTypeFilter === "year") {
					return sub.plan.includes("Yearly");
				}
				return true;
			});
		}

		// Filter by date range
		filtered = filtered.filter((sub) => {
			// Use appropriate date field based on tab
			let dateToCheck: string | undefined;
			if (activeTab === "active" || activeTab === "free") {
				dateToCheck = sub.nextBilling;
			} else if (activeTab === "trials") {
				dateToCheck = sub.trialEnd;
			} else if (activeTab === "inactive") {
				dateToCheck = sub.canceledAt;
			}

			// If no date field, include it (for manual access without dates)
			if (!dateToCheck) {
				return true;
			}

			return isWithinDateRange(dateToCheck);
		});

		return filtered;
	}, [subscriptions, planTypeFilter, activeTab, isWithinDateRange]);

	// Sort data
	const sortedSubscriptions = useMemo(() => {
		if (!sortColumn) {
			return filteredSubscriptions;
		}

		return [...filteredSubscriptions].sort((a, b) => {
			let aVal: any;
			let bVal: any;

			switch (sortColumn) {
				case "amount":
					aVal = a.amount;
					bVal = b.amount;
					break;
				case "started":
					aVal = new Date(a.startedAt || 0).getTime();
					bVal = new Date(b.startedAt || 0).getTime();
					break;
				case "daysLeft":
					aVal = a.trialEnd
						? Math.ceil(
								(new Date(a.trialEnd).getTime() - Date.now()) /
									(1000 * 60 * 60 * 24),
							)
						: 0;
					bVal = b.trialEnd
						? Math.ceil(
								(new Date(b.trialEnd).getTime() - Date.now()) /
									(1000 * 60 * 60 * 24),
							)
						: 0;
					break;
				default:
					return 0;
			}

			if (aVal < bVal) {
				return sortDirection === "asc" ? -1 : 1;
			}
			if (aVal > bVal) {
				return sortDirection === "asc" ? 1 : -1;
			}
			return 0;
		});
	}, [filteredSubscriptions, sortColumn, sortDirection]);

	const handleExportCSV = useCallback(() => {
		let headers: string[] = [];
		let filename = "";

		switch (activeTab) {
			case "active":
				headers = [
					"Name",
					"Email",
					"Status",
					"Plan",
					"Amount",
					"Coupon",
					"Started",
					"Next Billing",
				];
				filename = "subscriptions-active";
				break;
			case "trials":
				headers = [
					"Name",
					"Email",
					"Trial Type",
					"Days Left",
					"Trial Ends",
				];
				filename = "subscriptions-trials";
				break;
			case "free":
				headers = ["Name", "Email", "Type", "Granted Date", "Expires"];
				filename = "subscriptions-free";
				break;
			case "inactive":
				headers = ["Name", "Email", "Status", "Plan", "Cancelled Date"];
				filename = "subscriptions-inactive";
				break;
		}

		const _rows = sortedSubscriptions.map((sub) => {
			if (activeTab === "active") {
				return [
					sub.userName || "",
					sub.userEmail || "",
					sub.status,
					sub.plan,
					formatCurrency(sub.amount),
					sub.couponName || sub.couponCode || "",
					sub.startedAt ? formatDate(sub.startedAt) : "N/A",
					sub.nextBilling ? formatDate(sub.nextBilling) : "N/A",
				];
			}
			if (activeTab === "trials") {
				const daysLeft = sub.trialEnd
					? Math.ceil(
							(new Date(sub.trialEnd).getTime() - Date.now()) /
								(1000 * 60 * 60 * 24),
						)
					: 0;
				return [
					sub.userName || "",
					sub.userEmail || "",
					"Trial",
					daysLeft.toString(),
					sub.trialEnd ? formatDate(sub.trialEnd) : "N/A",
				];
			}
			if (activeTab === "free") {
				return [
					sub.userName || "",
					sub.userEmail || "",
					"Manual Access",
					sub.nextBilling ? formatDate(sub.nextBilling) : "N/A",
					sub.nextBilling ? formatDate(sub.nextBilling) : "Never",
				];
			}
			return [
				sub.userName || "",
				sub.userEmail || "",
				sub.status,
				sub.plan,
				sub.canceledAt ? formatDate(sub.canceledAt) : "N/A",
			];
		});

		exportToCSV(
			sortedSubscriptions,
			headers,
			(sub) => {
				if (activeTab === "active") {
					return [
						sub.userName || "",
						sub.userEmail || "",
						sub.status,
						sub.plan,
						formatCurrency(sub.amount),
						sub.couponName || sub.couponCode || "",
						sub.startedAt ? formatDate(sub.startedAt) : "N/A",
						sub.nextBilling ? formatDate(sub.nextBilling) : "N/A",
					];
				}
				if (activeTab === "trials") {
					const daysLeft = sub.trialEnd
						? Math.ceil(
								(new Date(sub.trialEnd).getTime() -
									Date.now()) /
									(1000 * 60 * 60 * 24),
							)
						: 0;
					return [
						sub.userName || "",
						sub.userEmail || "",
						"Trial",
						daysLeft.toString(),
						sub.trialEnd ? formatDate(sub.trialEnd) : "N/A",
					];
				}
				if (activeTab === "free") {
					return [
						sub.userName || "",
						sub.userEmail || "",
						"Manual Access",
						sub.nextBilling ? formatDate(sub.nextBilling) : "N/A",
						sub.nextBilling ? formatDate(sub.nextBilling) : "Never",
					];
				}
				return [
					sub.userName || "",
					sub.userEmail || "",
					sub.status,
					sub.plan,
					sub.canceledAt ? formatDate(sub.canceledAt) : "N/A",
				];
			},
			filename,
		);

		toast.success(
			`Exported ${sortedSubscriptions.length} ${activeTab} subscription${sortedSubscriptions.length !== 1 ? "s" : ""}`,
		);
	}, [activeTab, sortedSubscriptions]);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				e.key === "/" &&
				document.activeElement !== searchInputRef.current
			) {
				e.preventDefault();
				searchInputRef.current?.focus();
			}

			if (e.key === "Escape" && searchQuery) {
				setSearchQuery("");
				searchInputRef.current?.blur();
			}

			if (
				e.key === "ArrowDown" &&
				focusedRowIndex < sortedSubscriptions.length - 1
			) {
				e.preventDefault();
				setFocusedRowIndex((prev) => prev + 1);
			}

			if (e.key === "ArrowUp" && focusedRowIndex > 0) {
				e.preventDefault();
				setFocusedRowIndex((prev) => prev - 1);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [focusedRowIndex, sortedSubscriptions.length, searchQuery]);

	const handleManageActive = useCallback((sub: SubscriptionWithUser) => {
		setSelectedSubscription(sub);
		setIsActiveDialogOpen(true);
	}, []);

	const handleManageTrial = useCallback((sub: SubscriptionWithUser) => {
		setSelectedSubscription(sub);
		setIsTrialDialogOpen(true);
	}, []);

	const handleManageFreeAccess = useCallback((sub: SubscriptionWithUser) => {
		setSelectedSubscription(sub);
		setIsFreeAccessDialogOpen(true);
	}, []);

	const handleViewInactive = useCallback((sub: SubscriptionWithUser) => {
		setSelectedSubscription(sub);
		setIsInactiveDialogOpen(true);
	}, []);

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Subscriptions"
				description="The subscriptions management page requires a desktop screen to function properly."
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

	const SortIcon = ({ column }: { column: string }) => {
		if (sortColumn !== column) {
			return null;
		}
		return sortDirection === "asc" ? (
			<ArrowUp className="h-3 w-3 ml-1 inline-block" aria-hidden="true" />
		) : (
			<ArrowDown
				className="h-3 w-3 ml-1 inline-block"
				aria-hidden="true"
			/>
		);
	};

	const handleSort = (column: string) => {
		if (sortColumn === column) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortColumn(column);
			setSortDirection("asc");
		}
	};

	const isBillingEndingSoon = (dateString?: string): boolean => {
		if (!dateString) {
			return false;
		}
		const days = Math.ceil(
			(new Date(dateString).getTime() - Date.now()) /
				(1000 * 60 * 60 * 24),
		);
		return days > 0 && days < 7;
	};

	if (isLoading) {
		return (
			<div className="space-y-6 p-6">
				<div className="flex flex-col gap-4">
					<div>
						<Skeleton className="h-9 w-64 mb-2" />
						<Skeleton className="h-5 w-96" />
					</div>
					<StatsSkeleton />
				</div>
				<TableSkeleton rows={8} columns={7} />
			</div>
		);
	}

	return (
		<TooltipProvider>
			<div className="space-y-6">
				{/* Page Title */}
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-balance">
						Subscriptions
					</h1>
					<p className="text-muted-foreground mt-2">
						Manage subscription plans, trials, and access
					</p>
				</div>

				{/* Search and Filters */}
				<div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
					<div className="relative flex-1 max-w-md w-full">
						<Search
							className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
							aria-hidden="true"
						/>
						<Input
							placeholder="Search by user name or email... (Press / to focus)"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10"
							aria-label="Search subscriptions"
							onKeyDown={(e) => {
								if (
									e.key === "/" &&
									document.activeElement !== e.currentTarget
								) {
									e.preventDefault();
									e.currentTarget.focus();
								}
							}}
						/>
						{searchQuery && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setSearchQuery("")}
								className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
								aria-label="Clear search"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>

					<div className="flex gap-2 flex-wrap">
						<DateRangeSelect
							value={dateRange}
							customLabel={customDateLabel}
							onChange={setDateRange}
							onCustomRangeApply={handleCustomRangeApply}
							onClear={clearDateRange}
						/>

						<Select
							value={planTypeFilter}
							onValueChange={(value: any) =>
								setPlanTypeFilter(value)
							}
						>
							<SelectTrigger className="w-[140px]">
								<Filter className="mr-2 h-4 w-4" />
								<SelectValue placeholder="Plan Type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Plans</SelectItem>
								<SelectItem value="month">Monthly</SelectItem>
								<SelectItem value="year">Yearly</SelectItem>
							</SelectContent>
						</Select>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									className="shrink-0 bg-transparent"
								>
									<ChevronDown
										className="mr-2 h-4 w-4"
										aria-hidden="true"
									/>
									<span className="hidden sm:inline">
										Actions
									</span>
									<span className="sm:hidden">More</span>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuItem
									onClick={() => void handleSyncFromStripe()}
									disabled={syncMutation.isPending}
								>
									<RefreshCw
										className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
										aria-hidden="true"
									/>
									{syncMutation.isPending
										? "Syncing..."
										: "Sync from Stripe"}
								</DropdownMenuItem>
								<DropdownMenuItem onClick={handleExportCSV}>
									<Download
										className="mr-2 h-4 w-4"
										aria-hidden="true"
									/>
									Export CSV
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() =>
										setIsImportStripeDialogOpen(true)
									}
								>
									<Upload
										className="mr-2 h-4 w-4"
										aria-hidden="true"
									/>
									Import from Stripe
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Stats Cards Section */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{/* MRR */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-[#FF6B35]/10 flex items-center justify-center">
									<DollarSign
										className="h-6 w-6 text-[#FF6B35]"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										MRR
									</p>
									<p className="text-2xl font-bold">
										${stats.mrr.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">
										Monthly recurring revenue
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* ARR */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-[#FF6B35]/10 flex items-center justify-center">
									<TrendingUp
										className="h-6 w-6 text-[#FF6B35]"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										ARR
									</p>
									<p className="text-2xl font-bold">
										${stats.arr.toLocaleString()}
									</p>
									<p className="text-xs text-muted-foreground">
										Annual run rate
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Churn Rate */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
									<TrendingDown
										className="h-6 w-6 text-red-500"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Churn Rate
									</p>
									<p className="text-2xl font-bold">
										{stats.churnRate}%
									</p>
									<p className="text-xs text-muted-foreground">
										Cancellations this month
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Active Subscribers */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
									<Users
										className="h-6 w-6 text-green-500"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Active Subscribers
									</p>
									<p className="text-2xl font-bold">
										{stats.activeSubscribers}
									</p>
									<p className="text-xs text-muted-foreground">
										Paying customers
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Active Trials */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
									<Clock
										className="h-6 w-6 text-purple-500"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Active Trials
									</p>
									<p className="text-2xl font-bold">
										{stats.activeTrials}
									</p>
									<p className="text-xs text-muted-foreground">
										Potential conversions
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Free Access */}
					<Card>
						<CardContent className="p-6">
							<div className="flex items-center gap-4">
								<div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
									<Key
										className="h-6 w-6 text-blue-500"
										aria-hidden="true"
									/>
								</div>
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Free Access
									</p>
									<p className="text-2xl font-bold">
										{stats.freeAccess}
									</p>
									<p className="text-xs text-muted-foreground">
										Manually granted
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Tabs Section */}
				<div className="border-b border-border">
					<div
						className="flex gap-6 overflow-x-auto"
						role="tablist"
						aria-label="Subscription tabs"
					>
						<button
							type="button"
							onClick={() => {
								setActiveTab("active");
								setFocusedRowIndex(-1);
							}}
							role="tab"
							aria-selected={activeTab === "active"}
							aria-controls="active-panel"
							className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
								activeTab === "active"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Active ({stats.activeSubscribers})
							{activeTab === "active" && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35] animate-in slide-in-from-left duration-200" />
							)}
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab("trials");
								setFocusedRowIndex(-1);
							}}
							role="tab"
							aria-selected={activeTab === "trials"}
							aria-controls="trials-panel"
							className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
								activeTab === "trials"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Trials ({stats.activeTrials})
							{activeTab === "trials" && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35] animate-in slide-in-from-left duration-200" />
							)}
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab("free");
								setFocusedRowIndex(-1);
							}}
							role="tab"
							aria-selected={activeTab === "free"}
							aria-controls="free-panel"
							className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
								activeTab === "free"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Free Access ({stats.freeAccess})
							{activeTab === "free" && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35] animate-in slide-in-from-left duration-200" />
							)}
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab("inactive");
								setFocusedRowIndex(-1);
							}}
							role="tab"
							aria-selected={activeTab === "inactive"}
							aria-controls="inactive-panel"
							className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
								activeTab === "inactive"
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Inactive ({stats.inactiveSubscriptions})
							{activeTab === "inactive" && (
								<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B35] animate-in slide-in-from-left duration-200" />
							)}
						</button>
					</div>
				</div>

				{/* Content Area - Data Tables */}
				<Card>
					<div className="overflow-x-auto">
						{activeTab === "active" && (
							<div
								role="tabpanel"
								id="active-panel"
								aria-labelledby="active-tab"
								className="animate-in fade-in duration-150"
							>
								<table className="w-full">
									<thead className="border-b border-border">
										<tr>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												User
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Status
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Plan
											</th>
											<th
												scope="col"
												className="text-left p-0 text-sm font-medium"
												aria-sort={
													sortColumn === "amount"
														? sortDirection ===
															"asc"
															? "ascending"
															: "descending"
														: "none"
												}
											>
												<button
													type="button"
													className="w-full text-left p-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
													onClick={() =>
														handleSort("amount")
													}
												>
													Amount{" "}
													<SortIcon column="amount" />
												</button>
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Next Billing
											</th>
											<th
												scope="col"
												className="text-left p-0 text-sm font-medium"
												aria-sort={
													sortColumn === "started"
														? sortDirection ===
															"asc"
															? "ascending"
															: "descending"
														: "none"
												}
											>
												<button
													type="button"
													className="w-full text-left p-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
													onClick={() =>
														handleSort("started")
													}
												>
													Started{" "}
													<SortIcon column="started" />
												</button>
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{sortedSubscriptions.length === 0 ? (
											<tr>
												<td
													colSpan={7}
													className="text-center py-12"
												>
													{searchQuery ? (
														<div className="flex flex-col items-center gap-3">
															<div className="relative">
																<Search
																	className="h-12 w-12 text-muted-foreground"
																	aria-hidden="true"
																/>
																<X
																	className="h-6 w-6 text-muted-foreground absolute -top-1 -right-1"
																	aria-hidden="true"
																/>
															</div>
															<p className="text-muted-foreground">
																No results for "
																{searchQuery}"
															</p>
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	setSearchQuery(
																		"",
																	)
																}
															>
																Clear search
															</Button>
														</div>
													) : (
														<>
															<Users
																className="h-12 w-12 mx-auto text-muted-foreground mb-4"
																aria-hidden="true"
															/>
															<p className="text-muted-foreground">
																No active
																subscriptions
																yet.
															</p>
															<p className="text-xs text-muted-foreground mt-1">
																Users will
																appear here
																after signing
																up.
															</p>
														</>
													)}
												</td>
											</tr>
										) : (
											sortedSubscriptions.map(
												(sub, idx) => {
													const isEndingSoon =
														isBillingEndingSoon(
															sub.nextBilling,
														);

													return (
														<tr
															key={sub.id}
															className={`hover:bg-muted/50 transition-all duration-150 group relative ${
																idx % 2 === 0
																	? "bg-muted/20"
																	: ""
															} ${focusedRowIndex === idx ? "ring-2 ring-[#FF6B35]" : ""}`}
															tabIndex={0}
														>
															<td className="p-4">
																<div className="flex items-center gap-3">
																	<UserAvatar
																		className="h-9 w-9"
																		name={
																			sub.userName ??
																			sub.userEmail
																		}
																		avatarUrl={
																			sub.userAvatar
																		}
																	/>
																	<div className="min-w-0">
																		<p className="font-medium text-sm truncate">
																			{sub.userName ||
																				"Unknown"}
																		</p>
																		<Tooltip>
																			<TooltipTrigger
																				asChild
																			>
																				<p className="text-xs text-muted-foreground truncate max-w-[200px] cursor-help">
																					{sub.userEmail ||
																						"No email"}
																				</p>
																			</TooltipTrigger>
																			<TooltipContent>
																				<p>
																					{
																						sub.userEmail
																					}
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	</div>
																</div>
															</td>
															<td className="p-4">
																<SubscriptionStatusBadge
																	status={
																		sub.status ===
																		"grace_period"
																			? "grace_period"
																			: sub.status ===
																						"active" &&
																					sub.cancelAtPeriodEnd
																				? "scheduled_cancel"
																				: sub.status ===
																						"active"
																					? "active"
																					: sub.status ===
																							"trialing"
																						? "trialing"
																						: "cancelled"
																	}
																/>
															</td>
															<td className="p-4 text-sm">
																{sub.plan}
															</td>
															<td className="p-4 text-sm tabular-nums">
																<div className="flex items-center gap-2">
																	<span>
																		<span className="font-medium">
																			{formatCurrency(
																				sub.amount,
																			)}
																		</span>
																		{sub.plan.includes(
																			"Monthly",
																		)
																			? "/mo"
																			: "/yr"}
																	</span>
																	{sub.couponCode && (
																		<Tooltip>
																			<TooltipTrigger
																				asChild
																			>
																				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-500 border border-green-500/20 cursor-help">
																					<Tag className="h-3 w-3" />
																					Coupon
																				</span>
																			</TooltipTrigger>
																			<TooltipContent>
																				<p className="text-xs">
																					Coupon:{" "}
																					<span className="font-semibold">
																						{sub.couponName ||
																							sub.couponCode}
																					</span>
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	)}
																</div>
															</td>
															<td className="p-4 text-sm tabular-nums">
																<div className="flex items-center gap-1">
																	{isEndingSoon && (
																		<Tooltip>
																			<TooltipTrigger
																				asChild
																			>
																				<AlertCircle
																					className="h-3 w-3 text-amber-500 cursor-help"
																					aria-hidden="true"
																				/>
																			</TooltipTrigger>
																			<TooltipContent>
																				<p>
																					Renews{" "}
																					{sub.nextBilling
																						? formatRelativeTime(
																								sub.nextBilling,
																							)
																						: "soon"}
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	)}
																	<span
																		className={
																			isEndingSoon
																				? "text-amber-500"
																				: ""
																		}
																	>
																		{sub.nextBilling
																			? formatDate(
																					sub.nextBilling,
																				)
																			: "N/A"}
																	</span>
																</div>
															</td>
															<td className="p-4 text-sm text-muted-foreground tabular-nums">
																{sub.startedAt
																	? formatRelativeTime(
																			sub.startedAt,
																		)
																	: "N/A"}
															</td>
															<td className="p-4">
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() =>
																		handleManageActive(
																			sub,
																		)
																	}
																	className="hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors min-w-[80px]"
																>
																	Manage
																</Button>
															</td>
														</tr>
													);
												},
											)
										)}
									</tbody>
								</table>
							</div>
						)}

						{activeTab === "trials" && (
							<div
								role="tabpanel"
								id="trials-panel"
								aria-labelledby="trials-tab"
								className="animate-in fade-in duration-150"
							>
								<table className="w-full">
									<thead className="border-b border-border">
										<tr>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												User
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Status
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Plan
											</th>
											<th
												scope="col"
												className="text-left p-0 text-sm font-medium"
												aria-sort={
													sortColumn === "daysLeft"
														? sortDirection ===
															"asc"
															? "ascending"
															: "descending"
														: "none"
												}
											>
												<button
													type="button"
													className="w-full text-left p-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
													onClick={() =>
														handleSort("daysLeft")
													}
												>
													Days Left{" "}
													<SortIcon column="daysLeft" />
												</button>
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Trial Ends
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{sortedSubscriptions.length === 0 ? (
											<tr>
												<td
													colSpan={6}
													className="text-center py-12"
												>
													<Clock
														className="h-12 w-12 mx-auto text-muted-foreground mb-4"
														aria-hidden="true"
													/>
													<p className="text-muted-foreground">
														No active trials.
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														Trial users will appear
														here.
													</p>
												</td>
											</tr>
										) : (
											sortedSubscriptions.map(
												(sub, idx) => {
													const daysLeft =
														sub.trialEnd
															? Math.ceil(
																	(new Date(
																		sub.trialEnd,
																	).getTime() -
																		Date.now()) /
																		(1000 *
																			60 *
																			60 *
																			24),
																)
															: 0;

													return (
														<tr
															key={sub.id}
															className={`hover:bg-muted/50 transition-all duration-150 group ${
																idx % 2 === 0
																	? "bg-muted/20"
																	: ""
															} ${focusedRowIndex === idx ? "ring-2 ring-[#FF6B35]" : ""}`}
															tabIndex={0}
														>
															<td className="p-4">
																<div className="flex items-center gap-3">
																	<UserAvatar
																		className="h-9 w-9"
																		name={
																			sub.userName ??
																			sub.userEmail
																		}
																		avatarUrl={
																			sub.userAvatar
																		}
																	/>
																	<div className="min-w-0">
																		<p className="font-medium text-sm truncate">
																			{sub.userName ||
																				"Unknown"}
																		</p>
																		<p className="text-xs text-muted-foreground truncate max-w-[200px]">
																			{sub.userEmail ||
																				"No email"}
																		</p>
																	</div>
																</div>
															</td>
															<td className="p-4">
																<SubscriptionStatusBadge status="trial" />
															</td>
															<td className="p-4 text-sm">
																{sub.plan}
															</td>
															<td className="p-4 text-sm tabular-nums">
																<span
																	className={
																		daysLeft <
																		3
																			? "text-amber-500 font-medium"
																			: ""
																	}
																>
																	{daysLeft}{" "}
																	days
																</span>
															</td>
															<td className="p-4 text-sm tabular-nums">
																{sub.trialEnd
																	? formatDate(
																			sub.trialEnd,
																		)
																	: "N/A"}
															</td>
															<td className="p-4">
																<Button
																	size="sm"
																	variant="outline"
																	onClick={() =>
																		handleManageTrial(
																			sub,
																		)
																	}
																	className="hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors min-w-[80px]"
																>
																	Manage
																</Button>
															</td>
														</tr>
													);
												},
											)
										)}
									</tbody>
								</table>
							</div>
						)}

						{activeTab === "free" && (
							<div
								role="tabpanel"
								id="free-panel"
								aria-labelledby="free-tab"
								className="animate-in fade-in duration-150"
							>
								<table className="w-full">
									<thead className="border-b border-border">
										<tr>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												User
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Status
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Plan
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Granted
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{sortedSubscriptions.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="text-center py-12"
												>
													<Key
														className="h-12 w-12 mx-auto text-muted-foreground mb-4"
														aria-hidden="true"
													/>
													<p className="text-muted-foreground">
														No manually granted
														access.
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														Use 'Grant Free Months'
														to add users.
													</p>
												</td>
											</tr>
										) : (
											sortedSubscriptions.map(
												(sub, idx) => (
													<tr
														key={sub.id}
														className={`hover:bg-muted/50 transition-all duration-150 group ${
															idx % 2 === 0
																? "bg-muted/20"
																: ""
														} ${focusedRowIndex === idx ? "ring-2 ring-[#FF6B35]" : ""}`}
														tabIndex={0}
													>
														<td className="p-4">
															<div className="flex items-center gap-3">
																<UserAvatar
																	className="h-9 w-9"
																	name={
																		sub.userName ??
																		sub.userEmail
																	}
																	avatarUrl={
																		sub.userAvatar
																	}
																/>
																<div className="min-w-0">
																	<p className="font-medium text-sm truncate">
																		{sub.userName ||
																			"Unknown"}
																	</p>
																	<p className="text-xs text-muted-foreground truncate max-w-[200px]">
																		{sub.userEmail ||
																			"No email"}
																	</p>
																</div>
															</div>
														</td>
														<td className="p-4">
															<SubscriptionStatusBadge status="manual" />
														</td>
														<td className="p-4 text-sm">
															{sub.plan}
														</td>
														<td className="p-4 text-sm text-muted-foreground tabular-nums">
															{sub.nextBilling
																? formatDate(
																		sub.nextBilling,
																	)
																: "N/A"}
														</td>
														<td className="p-4">
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	handleManageFreeAccess(
																		sub,
																	)
																}
																className="hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors min-w-[80px]"
															>
																Manage
															</Button>
														</td>
													</tr>
												),
											)
										)}
									</tbody>
								</table>
							</div>
						)}

						{activeTab === "inactive" && (
							<div
								role="tabpanel"
								id="inactive-panel"
								aria-labelledby="inactive-tab"
								className="animate-in fade-in duration-150"
							>
								<table className="w-full">
									<thead className="border-b border-border">
										<tr>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												User
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Status
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Plan
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Cancelled
											</th>
											<th
												scope="col"
												className="text-left p-4 text-sm font-medium text-muted-foreground"
											>
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{sortedSubscriptions.length === 0 ? (
											<tr>
												<td
													colSpan={5}
													className="text-center py-12"
												>
													<Users
														className="h-12 w-12 mx-auto text-muted-foreground mb-4"
														aria-hidden="true"
													/>
													<p className="text-muted-foreground">
														No cancelled
														subscriptions.
													</p>
													<p className="text-xs text-muted-foreground mt-1">
														Previously active
														subscriptions will
														appear here.
													</p>
												</td>
											</tr>
										) : (
											sortedSubscriptions.map(
												(sub, idx) => (
													<tr
														key={sub.id}
														className={`hover:bg-muted/50 transition-all duration-150 opacity-70 group ${
															idx % 2 === 0
																? "bg-muted/20"
																: ""
														} ${focusedRowIndex === idx ? "ring-2 ring-[#FF6B35]" : ""}`}
														tabIndex={0}
													>
														<td className="p-4">
															<div className="flex items-center gap-3">
																<UserAvatar
																	className="h-9 w-9"
																	name={
																		sub.userName ??
																		sub.userEmail
																	}
																	avatarUrl={
																		sub.userAvatar
																	}
																/>
																<div className="min-w-0">
																	<p className="font-medium text-sm truncate">
																		{sub.userName ||
																			"Unknown"}
																	</p>
																	<p className="text-xs text-muted-foreground truncate max-w-[200px]">
																		{sub.userEmail ||
																			"No email"}
																	</p>
																</div>
															</div>
														</td>
														<td className="p-4">
															<SubscriptionStatusBadge status="cancelled" />
														</td>
														<td className="p-4 text-sm">
															{sub.plan}
														</td>
														<td className="p-4 text-sm text-muted-foreground tabular-nums">
															{sub.canceledAt
																? formatDate(
																		sub.canceledAt,
																	)
																: "Unknown"}
														</td>
														<td className="p-4">
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	handleViewInactive(
																		sub,
																	)
																}
																className="hover:bg-[#FF6B35] hover:text-white hover:border-[#FF6B35] transition-colors min-w-[80px]"
															>
																View Info
															</Button>
														</td>
													</tr>
												),
											)
										)}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</Card>

				{/* Dialogs */}
				<ManageActiveSubscriptionDialog
					subscription={selectedSubscription}
					open={isActiveDialogOpen}
					onOpenChange={setIsActiveDialogOpen}
					onSuccess={() => {
						setSelectedSubscription(null);
					}}
				/>

				<ManageTrialDialog
					subscription={selectedSubscription}
					open={isTrialDialogOpen}
					onOpenChange={setIsTrialDialogOpen}
					onSuccess={() => {
						setSelectedSubscription(null);
					}}
				/>

				<ManageFreeAccessDialog
					subscription={selectedSubscription}
					open={isFreeAccessDialogOpen}
					onOpenChange={setIsFreeAccessDialogOpen}
					onSuccess={() => {
						setSelectedSubscription(null);
					}}
				/>

				<ViewInactiveSubscriptionDialog
					subscription={selectedSubscription}
					open={isInactiveDialogOpen}
					onOpenChange={setIsInactiveDialogOpen}
					onSuccess={() => {
						setSelectedSubscription(null);
					}}
				/>

				<ImportStripeDialog
					open={isImportStripeDialogOpen}
					onOpenChange={setIsImportStripeDialogOpen}
					onImported={() => void refetch()}
				/>
			</div>
		</TooltipProvider>
	);
}
