"use client";

import type { AuditLogEntry } from "@repo/api/modules/admin/types";
import { DateRangeSelect } from "@saas/admin/component/DateRangeSelect";
import { TableSkeleton } from "@saas/admin/component/skeletons/TableSkeleton";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useDateRangeFilter } from "@saas/admin/hooks/use-date-range-filter";
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search";
import {
	exportToCSV,
	formatRelativeTime,
	getInitials,
} from "@saas/admin/lib/subscription-utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@ui/components/avatar";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Input } from "@ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useIsMobile } from "@ui/hooks/use-mobile";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Activity,
	AlertCircle,
	Bell,
	ChevronDown,
	ChevronRight,
	DollarSign,
	Download,
	Edit,
	RefreshCw,
	Search,
	Shield,
	Trash2,
	TrendingUp,
	UserCog,
	UserMinus,
	UserPlus,
	Users,
	X,
} from "@/modules/ui/icons";

// Enhanced type with adminName (from mock data)
interface AuditLogEntryWithName extends AuditLogEntry {
	adminName: string;
}

export default function AuditLogPage() {
	const isMobile = useIsMobile();
	const { searchQuery, setSearchQuery } = useDebouncedSearch();
	const [actionFilter, setActionFilter] = useState<string>("all");
	const [adminFilter, setAdminFilter] = useState<string>("all");
	const [expandedLog, setExpandedLog] = useState<string | null>(null);

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
		orpc.admin.auditLog.list.queryOptions({
			input: {
				actionType: actionFilter === "all" ? undefined : actionFilter,
				adminUserId: adminFilter === "all" ? undefined : adminFilter,
			},
		}),
	);

	const logs = (data?.logs || []) as AuditLogEntryWithName[];
	const stats = data?.stats || {
		totalActions: 0,
		actionsToday: 0,
		actionsThisWeek: 0,
		mostActiveAdmin: { userId: "", name: "", count: 0 },
		mostCommonAction: { type: "", count: 0 },
	};

	// Get unique admins for filter dropdown
	const uniqueAdmins = useMemo(() => {
		const adminMap = new Map<
			string,
			{ id: string; name: string; email: string }
		>();
		logs.forEach((log) => {
			if (!adminMap.has(log.adminUserId)) {
				adminMap.set(log.adminUserId, {
					id: log.adminUserId,
					name: log.adminName || log.adminEmail,
					email: log.adminEmail,
				});
			}
		});
		return Array.from(adminMap.values());
	}, [logs]);

	// Search shortcut handler
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
				e.preventDefault();
				const input = document.getElementById(
					"audit-log-search-input",
				) as HTMLInputElement;
				input?.focus();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Helper functions
	const getActionIcon = (actionType: string) => {
		const key = actionType.toLowerCase();
		const icons: Record<string, any> = {
			grant_access: UserPlus,
			revoke_access: UserMinus,
			role_change: UserCog,
			user_delete: Trash2,
			subscription_change: DollarSign,
			announcement_create: Bell,
			announcement_update: Bell,
			announcement_delete: Trash2,
			content_modify: Edit,
			system_config: Shield,
		};
		return icons[key] || Activity;
	};

	const getActionColor = (actionType: string) => {
		const key = actionType.toLowerCase();
		const colors: Record<string, string> = {
			grant_access: "bg-green-500/10 text-green-500 border-green-500/20",
			announcement_create:
				"bg-green-500/10 text-green-500 border-green-500/20",
			revoke_access: "bg-red-500/10 text-red-500 border-red-500/20",
			user_delete: "bg-red-500/10 text-red-500 border-red-500/20",
			announcement_delete: "bg-red-500/10 text-red-500 border-red-500/20",
			role_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
			subscription_change:
				"bg-blue-500/10 text-blue-500 border-blue-500/20",
			announcement_update:
				"bg-blue-500/10 text-blue-500 border-blue-500/20",
			content_modify: "bg-blue-500/10 text-blue-500 border-blue-500/20",
			system_config: "bg-amber-500/10 text-amber-500 border-amber-500/20",
		};
		return colors[key] || "bg-gray-500/10 text-gray-500 border-gray-500/20";
	};

	const getActionLabel = (actionType: string) => {
		return actionType
			.toLowerCase()
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Client-side filtering
	const filteredLogs = useMemo(() => {
		return logs.filter((log) => {
			const matchesSearch =
				!searchQuery ||
				log.targetName
					?.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				log.targetId
					?.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				log.previousValue
					?.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				log.newValue
					?.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				log.reason?.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesDate = isWithinDateRange(log.timestamp);

			return matchesSearch && matchesDate;
		});
	}, [logs, searchQuery, isWithinDateRange]);

	// Export CSV
	const handleExportCSV = useCallback(() => {
		exportToCSV(
			filteredLogs,
			[
				"Timestamp",
				"Admin",
				"Action",
				"Summary",
				"Target",
				"Previous Value",
				"New Value",
				"Reason",
				"IP Address",
			],
			(log) => [
				log.timestamp,
				`${log.adminName || "Unknown"} (${log.adminEmail})`,
				getActionLabel(log.actionType),
				log.summary || "N/A",
				log.targetName || log.targetId,
				log.previousValue || "N/A",
				log.newValue || "N/A",
				log.reason || "N/A",
				log.ipAddress || "N/A",
			],
			"audit-log-export",
		);
		toast.success(
			`Exported ${filteredLogs.length} log entr${filteredLogs.length !== 1 ? "ies" : "y"}`,
		);
	}, [filteredLogs]);

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Audit Log"
				description="The audit log requires a desktop screen to function properly."
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
			{/* Header Section */}
			<div>
				<h1 className="text-3xl font-bold tracking-tight text-balance">
					Audit Log
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Review administrative actions and system events
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Card className="transition-transform duration-150 hover:scale-[1.01]">
					<div className="p-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35]/10">
								<Activity className="h-5 w-5 text-[#FF6B35]" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									Total Actions
								</p>
								<p className="text-xl font-bold">
									{stats.totalActions}
								</p>
							</div>
						</div>
					</div>
				</Card>

				<Card className="transition-transform duration-150 hover:scale-[1.01]">
					<div className="p-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
								<TrendingUp className="h-5 w-5 text-green-500" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									Today
								</p>
								<p className="text-xl font-bold">
									{"actionsToday" in stats
										? stats.actionsToday
										: 0}
								</p>
							</div>
						</div>
					</div>
				</Card>

				<Card className="transition-transform duration-150 hover:scale-[1.01]">
					<div className="p-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
								<Users className="h-5 w-5 text-blue-500" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									Most Active
								</p>
								<p className="truncate text-sm font-bold">
									{stats?.mostActiveAdmin?.name?.split(
										" ",
									)[0] || "N/A"}
								</p>
							</div>
						</div>
					</div>
				</Card>

				<Card className="transition-transform duration-150 hover:scale-[1.01]">
					<div className="p-4">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
								<AlertCircle className="h-5 w-5 text-purple-500" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									Common Action
								</p>
								<p className="truncate text-sm font-bold">
									{getActionLabel(
										stats?.mostCommonAction?.type || "",
									).split(" ")[0] || "N/A"}
								</p>
							</div>
						</div>
					</div>
				</Card>
			</div>

			{/* Filters Section */}
			<Card>
				<div className="space-y-3 p-4">
					{/* Search and Export */}
					<div className="flex flex-col gap-3 sm:flex-row">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								id="audit-log-search-input"
								placeholder="Search actions... (Press / to focus)"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 pl-10"
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
						<Button
							onClick={handleExportCSV}
							size="sm"
							variant="outline"
							className="h-9 shrink-0 bg-transparent"
						>
							<Download className="mr-2 h-4 w-4" />
							Export
						</Button>
					</div>

					{/* Filter Controls */}
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<DateRangeSelect
							value={dateRange}
							customLabel={customDateLabel}
							onChange={setDateRange}
							onCustomRangeApply={handleCustomRangeApply}
							onClear={clearDateRange}
						/>

						<Select
							value={actionFilter}
							onValueChange={setActionFilter}
						>
							<SelectTrigger className="h-9">
								<SelectValue placeholder="All Actions" />
							</SelectTrigger>
							<SelectContent className="max-h-[400px] overflow-y-auto">
								<SelectItem value="all">All Actions</SelectItem>

								<SelectGroup>
									<SelectLabel>User Management</SelectLabel>
									<SelectItem value="grant_access">
										Grant Access
									</SelectItem>
									<SelectItem value="revoke_access">
										Revoke Access
									</SelectItem>
									<SelectItem value="assign_role">
										Assign Role
									</SelectItem>
									<SelectItem value="create_user">
										Create User
									</SelectItem>
									<SelectItem value="delete_user">
										Delete User
									</SelectItem>
									<SelectItem value="impersonate_user">
										Impersonate User
									</SelectItem>
									<SelectItem value="stop_impersonation">
										Stop Impersonation
									</SelectItem>
									<SelectItem value="export_user_data">
										Export User Data
									</SelectItem>
									<SelectItem value="restore_user">
										Restore User
									</SelectItem>
								</SelectGroup>

								<SelectGroup>
									<SelectLabel>
										Subscription Management
									</SelectLabel>
									<SelectItem value="cancel_subscription">
										Cancel Subscription
									</SelectItem>
									<SelectItem value="apply_coupon">
										Apply Coupon
									</SelectItem>
									<SelectItem value="apply_credit">
										Apply Credit
									</SelectItem>
									<SelectItem value="change_plan">
										Change Plan
									</SelectItem>
									<SelectItem value="extend_trial">
										Extend Trial
									</SelectItem>
									<SelectItem value="sync_stripe">
										Sync Stripe
									</SelectItem>
									<SelectItem value="grant_free_months">
										Grant Free Months
									</SelectItem>
									<SelectItem value="convert_to_paid">
										Convert to Paid
									</SelectItem>
								</SelectGroup>

								<SelectGroup>
									<SelectLabel>Affiliates</SelectLabel>
									<SelectItem value="link_affiliate">
										Link Affiliate
									</SelectItem>
									<SelectItem value="unlink_affiliate">
										Unlink Affiliate
									</SelectItem>
								</SelectGroup>

								<SelectGroup>
									<SelectLabel>
										Content Management
									</SelectLabel>
									<SelectItem value="create_announcement">
										Create Announcement
									</SelectItem>
									<SelectItem value="update_announcement">
										Update Announcement
									</SelectItem>
									<SelectItem value="delete_announcement">
										Delete Announcement
									</SelectItem>
									<SelectItem value="create_notification">
										Create Notification
									</SelectItem>
								</SelectGroup>

								<SelectGroup>
									<SelectLabel>System</SelectLabel>
									<SelectItem value="system_action">
										System Action
									</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>

						<Select
							value={adminFilter}
							onValueChange={setAdminFilter}
						>
							<SelectTrigger className="h-9">
								<SelectValue placeholder="All Admins" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Admins</SelectItem>
								{uniqueAdmins.map((admin) => (
									<SelectItem key={admin.id} value={admin.id}>
										{admin.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Active Filters Display */}
					{(actionFilter !== "all" || adminFilter !== "all") && (
						<div className="flex flex-wrap items-center gap-2">
							{actionFilter !== "all" && (
								<Badge className="h-6 gap-1 text-xs">
									{getActionLabel(actionFilter)}
									<X
										className="h-3 w-3 cursor-pointer"
										onClick={() => setActionFilter("all")}
									/>
								</Badge>
							)}
							{adminFilter !== "all" && (
								<Badge className="h-6 gap-1 text-xs">
									{
										uniqueAdmins.find(
											(a) => a.id === adminFilter,
										)?.name
									}
									<X
										className="h-3 w-3 cursor-pointer"
										onClick={() => setAdminFilter("all")}
									/>
								</Badge>
							)}
						</div>
					)}
				</div>
			</Card>

			{/* Audit Log Entries */}
			{isLoading ? (
				<TableSkeleton rows={8} columns={6} />
			) : (
				<Card>
					<div className="overflow-x-auto">
						{filteredLogs.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-12">
								<Activity className="mb-3 h-12 w-12 text-muted-foreground" />
								<p className="text-muted-foreground">
									No audit logs found
								</p>
								{searchQuery && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => setSearchQuery("")}
										className="mt-3"
									>
										Clear search
									</Button>
								)}
							</div>
						) : (
							<div className="divide-y divide-border">
								{filteredLogs.map((log) => {
									const Icon = getActionIcon(log.actionType);
									const isExpanded = expandedLog === log.id;

									return (
										<div
											key={log.id}
											className="transition-colors hover:bg-muted/30"
										>
											<button
												type="button"
												className="flex cursor-pointer items-center gap-3 p-3 w-full text-left"
												onClick={() =>
													setExpandedLog(
														isExpanded
															? null
															: log.id,
													)
												}
											>
												{/* Expand indicator */}
												<div className="shrink-0">
													{isExpanded ? (
														<ChevronDown className="h-4 w-4 text-muted-foreground" />
													) : (
														<ChevronRight className="h-4 w-4 text-muted-foreground" />
													)}
												</div>

												{/* Timestamp */}
												<div className="w-32 shrink-0">
													<p className="text-xs font-medium">
														{formatRelativeTime(
															log.timestamp,
														)}
													</p>
													<p className="text-[10px] text-muted-foreground">
														{new Date(
															log.timestamp,
														).toLocaleDateString()}
													</p>
												</div>

												{/* Admin */}
												<div className="flex w-40 shrink-0 items-center gap-2">
													<Avatar className="h-7 w-7">
														<AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
															{getInitials(
																log.adminName ||
																	log.adminEmail,
															)}
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="truncate text-xs font-medium">
															{log.adminName ||
																log.adminEmail}
														</p>
													</div>
												</div>

												{/* Action badge */}
												<div className="shrink-0">
													<Badge
														className={`${getActionColor(log.actionType)} h-6 gap-1 text-xs`}
													>
														<Icon className="h-3 w-3" />
														{getActionLabel(
															log.actionType,
														)}
													</Badge>
												</div>

												{/* Target and details */}
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm">
														<span className="font-medium">
															{log.targetName ||
																log.targetId}
														</span>
													</p>
													<p className="truncate text-xs text-muted-foreground">
														{log.summary ||
															log.reason ||
															`${log.targetEntity} ${log.actionType}`}
													</p>
												</div>

												{/* IP Address */}
												<div className="w-28 shrink-0 text-right">
													<p className="font-mono text-xs text-muted-foreground">
														{log.ipAddress || "N/A"}
													</p>
												</div>
											</button>

											{isExpanded && (
												<div className="bg-muted/20 px-3 pb-3 pt-0">
													<div className="space-y-4 rounded-lg bg-background p-4">
														{/* Admin Details */}
														<div>
															<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																Admin Details
															</h4>
															<div className="grid grid-cols-2 gap-3 text-sm">
																<div>
																	<span className="text-muted-foreground">
																		Name:
																	</span>{" "}
																	<span className="font-medium">
																		{log.adminName ||
																			"Unknown"}
																	</span>
																</div>
																<div>
																	<span className="text-muted-foreground">
																		Email:
																	</span>{" "}
																	<span className="font-medium">
																		{
																			log.adminEmail
																		}
																	</span>
																</div>
															</div>
														</div>

														{/* Target Details */}
														<div>
															<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																Target Details
															</h4>
															<div className="grid grid-cols-2 gap-3 text-sm">
																<div>
																	<span className="text-muted-foreground">
																		Type:
																	</span>{" "}
																	<Badge className="ml-1 h-5 text-xs">
																		{
																			log.targetEntity
																		}
																	</Badge>
																</div>
																<div>
																	<span className="text-muted-foreground">
																		Name:
																	</span>{" "}
																	<span className="font-medium">
																		{log.targetName ||
																			log.targetId}
																	</span>
																</div>
															</div>
														</div>

														{log.summary && (
															<div>
																<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																	Summary
																</h4>
																<p className="rounded bg-muted/50 p-3 text-sm">
																	{
																		log.summary
																	}
																</p>
															</div>
														)}

														{/* Reason */}
														{log.reason && (
															<div>
																<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																	Reason
																</h4>
																<p className="rounded bg-muted/50 p-3 text-sm italic">
																	{log.reason}
																</p>
															</div>
														)}

														{/* State Changes */}
														{(log.previousValue ||
															log.newValue) && (
															<div>
																<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																	State
																	Changes
																</h4>
																<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
																	{log.previousValue && (
																		<div>
																			<p className="mb-1 text-xs font-medium text-muted-foreground">
																				Before
																			</p>
																			<pre className="overflow-x-auto rounded bg-muted/50 p-3 text-[10px]">
																				{
																					log.previousValue
																				}
																			</pre>
																		</div>
																	)}
																	{log.newValue && (
																		<div>
																			<p className="mb-1 text-xs font-medium text-muted-foreground">
																				After
																			</p>
																			<pre className="overflow-x-auto rounded bg-muted/50 p-3 text-[10px]">
																				{
																					log.newValue
																				}
																			</pre>
																		</div>
																	)}
																</div>
															</div>
														)}

														{/* Metadata */}
														{log.metadata &&
															Object.keys(
																log.metadata,
															).length > 0 && (
																<div>
																	<h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
																		Metadata
																	</h4>
																	<pre className="overflow-x-auto rounded bg-muted/50 p-3 text-[10px]">
																		{JSON.stringify(
																			log.metadata,
																			null,
																			2,
																		)}
																	</pre>
																</div>
															)}

														{/* Footer */}
														<div className="border-t border-border pt-2">
															<div className="flex items-center justify-between text-xs text-muted-foreground">
																<span>
																	Action ID:{" "}
																	{log.id}
																</span>
																<span>
																	IP:{" "}
																	{log.ipAddress ||
																		"N/A"}
																</span>
															</div>
														</div>
													</div>
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>

					{filteredLogs.length > 0 && (
						<div className="border-t border-border bg-muted/20 px-4 py-2">
							<p className="text-xs text-muted-foreground">
								Showing {filteredLogs.length} of {logs.length}{" "}
								action{logs.length !== 1 ? "s" : ""}
							</p>
						</div>
					)}
				</Card>
			)}
		</div>
	);
}
