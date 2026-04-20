"use client";

import { DateRangeSelect } from "@saas/admin/component/DateRangeSelect";
import {
	DiscordBadge,
	RoleBadge,
	SubscriptionStatusBadge,
} from "@saas/admin/component/StatusBadges";
import { StatsSkeleton } from "@saas/admin/component/skeletons/StatsSkeleton";
import { TableSkeleton } from "@saas/admin/component/skeletons/TableSkeleton";
import { AddUserDialog } from "@saas/admin/component/users/AddUserDialog";
import { AssignRoleDialog } from "@saas/admin/component/users/AssignRoleDialog";
import { GrantAccessDialog } from "@saas/admin/component/users/GrantAccessDialog";
import { ManageSubscriptionDialog } from "@saas/admin/component/users/ManageSubscriptionDialog";
import { RevokeAccessDialog } from "@saas/admin/component/users/RevokeAccessDialog";
import { SendDiscordInviteDialog } from "@saas/admin/component/users/SendDiscordInviteDialog";
import { UserActionsMenu } from "@saas/admin/component/users/UserActionsMenu";
import { UserOverviewDialog } from "@saas/admin/component/users/UserOverviewDialog";
import { ViewSubscriptionDialog } from "@saas/admin/component/users/ViewSubscriptionDialog";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useDateRangeFilter } from "@saas/admin/hooks/use-date-range-filter";
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search";
import { formatAppRoleLabel } from "@saas/admin/lib/app-role-label";
import {
	exportToCSV,
	formatRelativeTime,
} from "@saas/admin/lib/subscription-utils";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { useIsMobile } from "@ui/hooks/use-mobile";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	Download,
	Filter,
	RefreshCw,
	Search,
	UserPlus,
	X,
} from "@/modules/ui/icons";

export default function UsersPage() {
	const isMobile = useIsMobile();
	const { searchQuery, setSearchQuery, debouncedQuery } =
		useDebouncedSearch();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const [subscriptionFilter, setSubscriptionFilter] = useState<string>("all");
	const [discordFilter, setDiscordFilter] = useState<string>("all");
	const [roleFilter, setRoleFilter] = useState<string>("all");

	const {
		dateRange,
		setDateRange,
		customDateLabel,
		isWithinDateRange,
		handleCustomRangeApply,
		clearDateRange,
	} = useDateRangeFilter();

	// Dialog states
	const [selectedUser, setSelectedUser] = useState<any>(null);
	const [grantAccessOpen, setGrantAccessOpen] = useState(false);
	const [revokeAccessOpen, setRevokeAccessOpen] = useState(false);
	const [assignRoleOpen, setAssignRoleOpen] = useState(false);
	const [overviewOpen, setOverviewOpen] = useState(false);
	const [viewSubscriptionOpen, setViewSubscriptionOpen] = useState(false);
	const [addUserOpen, setAddUserOpen] = useState(false);
	const [manageSubscriptionOpen, setManageSubscriptionOpen] = useState(false);
	const [sendDiscordInviteOpen, setSendDiscordInviteOpen] = useState(false);

	// Fetch data using ORPC (same pattern as other admin pages)
	const { data, isLoading, isError, error, refetch } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: {
				searchTerm: debouncedQuery || undefined,
				subscriptionStatus:
					subscriptionFilter === "all"
						? undefined
						: (subscriptionFilter as any),
				discordConnected:
					discordFilter === "all"
						? undefined
						: discordFilter === "connected",
				role:
					roleFilter === "all"
						? undefined
						: (roleFilter as
								| "owner"
								| "analytics_viewer"
								| "admin"
								| "support"
								| "user"),
			},
		}),
	);

	const users = data?.users || [];
	const stats = data?.stats || {
		totalUsers: 0,
		activeSubscriptions: 0,
		manualAccess: 0,
		discordConnected: 0,
	};

	// Client-side date filtering
	const filteredUsers = useMemo(() => {
		return users.filter((user) => isWithinDateRange(user.joinedAt));
	}, [users, isWithinDateRange]);

	// Keyboard shortcut for search
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

	const handleExportCSV = useCallback(() => {
		exportToCSV(
			filteredUsers,
			[
				"Name",
				"Email",
				"Stripe Email",
				"Notification Email",
				"Subscription Status",
				"Plan Label",
				"Stripe Customer ID",
				"Stripe Subscription ID",
				"Discord Connected",
				"Role",
				"Is Affiliate",
				"Affiliate Slug",
				"Referred By",
				"Joined Date",
			],
			(user) => [
				user.name,
				user.email,
				user.stripeEmail ?? "",
				user.notificationEmail ?? "",
				user.subscriptionStatus,
				user.planLabel ?? "",
				user.stripeCustomerId ?? "",
				user.stripeSubscriptionId ?? "",
				user.discordConnected ? "Yes" : "No",
				formatAppRoleLabel(user.role),
				user.isAffiliate ? "Yes" : "No",
				user.affiliateData?.slug ?? "",
				user.referredBySlug ?? "",
				new Date(user.joinedAt).toLocaleDateString(),
			],
			"users-export",
		);
		toast.success(
			`Exported ${filteredUsers.length} user${filteredUsers.length !== 1 ? "s" : ""}`,
		);
	}, [filteredUsers]);

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Users"
				description="Manage user accounts, subscriptions, and permissions"
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
		<div className="space-y-6 p-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-balance">
						Users
					</h1>
					<p className="text-muted-foreground mt-2">
						Manage user accounts, subscriptions, and permissions
					</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportCSV}
					>
						<Download className="mr-2 h-4 w-4" />
						Export
					</Button>
					<Button size="sm" onClick={() => setAddUserOpen(true)}>
						<UserPlus className="mr-2 h-4 w-4" />
						Add User
					</Button>
				</div>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="h-12 w-12 rounded-full bg-[#FF6B35]/10 flex items-center justify-center">
								<UserPlus className="h-6 w-6 text-[#FF6B35]" />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Total Users
								</p>
								<p className="text-2xl font-bold">
									{stats.totalUsers}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
								<UserPlus className="h-6 w-6 text-green-500" />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Active Subscriptions
								</p>
								<p className="text-2xl font-bold">
									{stats.activeSubscriptions}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
								<UserPlus className="h-6 w-6 text-purple-500" />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Manual Access
								</p>
								<p className="text-2xl font-bold">
									{stats.manualAccess}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="p-6">
						<div className="flex items-center gap-4">
							<div className="h-12 w-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
								<UserPlus className="h-6 w-6 text-indigo-500" />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Discord Connected
								</p>
								<p className="text-2xl font-bold">
									{stats.discordConnected}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Main Content Card */}
			<Card>
				<CardHeader>
					<CardTitle>User Management</CardTitle>
					<CardDescription>
						View and manage all platform users (
						{filteredUsers.length} users)
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{/* Filters */}
						<div className="flex flex-col gap-4">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									ref={searchInputRef}
									placeholder="Search by name or email... (Press '/' to focus)"
									value={searchQuery}
									onChange={(e) =>
										setSearchQuery(e.target.value)
									}
									className="pl-9"
								/>
								{searchQuery && (
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setSearchQuery("")}
										className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
									>
										<X className="h-3 w-3" />
									</Button>
								)}
							</div>

							<div className="flex flex-wrap gap-2">
								<DateRangeSelect
									value={dateRange}
									customLabel={customDateLabel}
									onChange={setDateRange}
									onCustomRangeApply={handleCustomRangeApply}
									onClear={clearDateRange}
								/>

								<Select
									value={subscriptionFilter}
									onValueChange={setSubscriptionFilter}
								>
									<SelectTrigger className="w-[200px]">
										<div className="flex items-center gap-2 overflow-hidden">
											<Filter className="h-4 w-4 shrink-0" />
											<SelectValue placeholder="Subscription" />
										</div>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All Subscriptions
										</SelectItem>
										<SelectItem value="active">
											Active
										</SelectItem>
										<SelectItem value="trial">
											Trial
										</SelectItem>
										<SelectItem value="cancelled">
											Cancelled
										</SelectItem>
										<SelectItem value="scheduled_cancel">
											Scheduled cancel
										</SelectItem>
										<SelectItem value="grace_period">
											Grace period (payment)
										</SelectItem>
										<SelectItem value="none">
											No Subscription
										</SelectItem>
										<SelectItem value="manual">
											Manual Access
										</SelectItem>
										<SelectItem value="lifetime">
											Lifetime
										</SelectItem>
									</SelectContent>
								</Select>

								<Select
									value={discordFilter}
									onValueChange={setDiscordFilter}
								>
									<SelectTrigger className="w-[200px]">
										<div className="flex items-center gap-2 overflow-hidden">
											<Filter className="h-4 w-4 shrink-0" />
											<SelectValue placeholder="Discord" />
										</div>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All Discord Status
										</SelectItem>
										<SelectItem value="connected">
											Connected
										</SelectItem>
										<SelectItem value="not_connected">
											Not Connected
										</SelectItem>
									</SelectContent>
								</Select>

								<Select
									value={roleFilter}
									onValueChange={setRoleFilter}
								>
									<SelectTrigger className="w-[160px]">
										<div className="flex items-center gap-2 overflow-hidden">
											<Filter className="h-4 w-4 shrink-0" />
											<SelectValue placeholder="Role" />
										</div>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All Roles
										</SelectItem>
										<SelectItem value="owner">
											Owner
										</SelectItem>
										<SelectItem value="admin">
											Administrator
										</SelectItem>
										<SelectItem value="analytics_viewer">
											Analytics viewer
										</SelectItem>
										<SelectItem value="support">
											Support
										</SelectItem>
										<SelectItem value="user">
											Standard users
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Users Table */}
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>User</TableHead>
										<TableHead>Subscription</TableHead>
										<TableHead>Discord</TableHead>
										<TableHead>Role</TableHead>
										<TableHead>Joined</TableHead>
										<TableHead className="text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredUsers.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												className="text-center py-8 text-muted-foreground"
											>
												No users found matching your
												filters
											</TableCell>
										</TableRow>
									) : (
										filteredUsers.map((user) => {
											return (
												<TableRow
													key={user.id}
													className="hover:bg-muted/50 transition-colors"
												>
													<TableCell>
														<div className="flex items-center gap-3">
															<UserAvatar
																className="h-9 w-9"
																name={
																	user.name ??
																	user.email
																}
																avatarUrl={
																	user.avatar
																}
															/>
															<div className="flex flex-col">
																<span className="font-medium text-sm">
																	{user.name}
																</span>
																<span className="text-xs text-muted-foreground">
																	{user.email}
																</span>
															</div>
														</div>
													</TableCell>
													<TableCell>
														<SubscriptionStatusBadge
															status={
																user.subscriptionStatus as any
															}
														/>
													</TableCell>
													<TableCell>
														{user.discordConnected ? (
															<DiscordBadge
																isConnected={
																	true
																}
															/>
														) : (
															<Badge className="border-muted-foreground/30">
																Not Connected
															</Badge>
														)}
													</TableCell>
													<TableCell>
														{user.role &&
														user.role !== "user" ? (
															<RoleBadge
																role={user.role}
															/>
														) : (
															<span className="text-sm text-muted-foreground">
																User
															</span>
														)}
													</TableCell>
													<TableCell className="tabular-nums">
														<span className="text-sm text-muted-foreground">
															{formatRelativeTime(
																user.joinedAt,
															)}
														</span>
													</TableCell>
													<TableCell className="text-right">
														<UserActionsMenu
															user={user}
															onViewOverview={() => {
																setSelectedUser(
																	user,
																);
																setOverviewOpen(
																	true,
																);
															}}
															onManageSubscription={() => {
																// Redirect to subscriptions page with user filter
																window.location.href = `/admin/subscriptions?user=${encodeURIComponent(user.email)}&manage=true`;
															}}
															onAssignRole={() => {
																setSelectedUser(
																	user,
																);
																setAssignRoleOpen(
																	true,
																);
															}}
															onGrantAccess={() => {
																setSelectedUser(
																	user,
																);
																setGrantAccessOpen(
																	true,
																);
															}}
															onRevokeAccess={() => {
																setSelectedUser(
																	user,
																);
																setRevokeAccessOpen(
																	true,
																);
															}}
															onViewSubscription={() => {
																setSelectedUser(
																	user,
																);
																setViewSubscriptionOpen(
																	true,
																);
															}}
															onSendDiscordInvite={() => {
																setSelectedUser(
																	user,
																);
																setSendDiscordInviteOpen(
																	true,
																);
															}}
															onDiscordChanged={() =>
																refetch()
															}
															onUserDeleted={() =>
																refetch()
															}
														/>
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Dialogs */}
			<GrantAccessDialog
				user={selectedUser}
				open={grantAccessOpen}
				onOpenChange={setGrantAccessOpen}
			/>
			<RevokeAccessDialog
				user={selectedUser}
				open={revokeAccessOpen}
				onOpenChange={setRevokeAccessOpen}
			/>
			<AssignRoleDialog
				user={selectedUser}
				open={assignRoleOpen}
				onOpenChange={setAssignRoleOpen}
			/>
			<UserOverviewDialog
				user={selectedUser}
				open={overviewOpen}
				onOpenChange={setOverviewOpen}
			/>
			<ViewSubscriptionDialog
				user={selectedUser}
				open={viewSubscriptionOpen}
				onOpenChange={setViewSubscriptionOpen}
			/>
			<AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} />
			<ManageSubscriptionDialog
				user={selectedUser}
				open={manageSubscriptionOpen}
				onOpenChange={setManageSubscriptionOpen}
			/>
			<SendDiscordInviteDialog
				user={selectedUser}
				open={sendDiscordInviteOpen}
				onOpenChange={setSendDiscordInviteOpen}
			/>
		</div>
	);
}
