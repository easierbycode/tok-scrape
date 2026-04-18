"use client";

import {
	type NotificationType,
	notificationTypeColors,
	notificationTypeLabels,
} from "@repo/api/modules/admin/types/notification-types";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useNotificationSettings } from "@saas/admin/hooks/use-notification-settings";
import { formatRelativeTime } from "@saas/admin/lib/subscription-utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Input } from "@ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useIsMobile } from "@ui/hooks/use-mobile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	Bell,
	Check,
	CheckCheck,
	ExternalLink,
	Filter,
	RefreshCw,
	Search,
	Settings,
	X,
} from "@/modules/ui/icons";

export default function NotificationsPage() {
	const isMobile = useIsMobile();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<"all" | NotificationType>(
		"all",
	);
	const [readStatusFilter, setReadStatusFilter] = useState<
		"all" | "unread" | "read"
	>("all");

	const { shouldDisplay, isNotificationExpired } = useNotificationSettings();

	// Fetch notifications
	const { data, isLoading, isError, error, refetch } = useQuery(
		orpc.admin.notifications.list.queryOptions({
			search: searchQuery || undefined,
			type: typeFilter,
			readStatus: readStatusFilter,
			dismissed: false,
			limit: 100,
			offset: 0,
		}),
	);

	// Mutations
	const markReadMutation = useMutation(
		orpc.admin.notifications.markRead.mutationOptions(),
	);
	const markAllReadMutation = useMutation(
		orpc.admin.notifications.markAllRead.mutationOptions(),
	);
	const dismissMutation = useMutation(
		orpc.admin.notifications.dismiss.mutationOptions(),
	);

	// Extract data with safe defaults BEFORE any early returns (hooks rule)
	const notifications = data?.notifications || [];
	const stats = data?.stats || {
		total: 0,
		unread: 0,
		dismissed: 0,
		byType: {},
	};

	// Filter notifications based on settings (hooks must be called before early returns)
	const filteredNotifications = useMemo(() => {
		return notifications
			.filter((n) => shouldDisplay(n.type))
			.filter((n) => !isNotificationExpired(n.createdAt));
	}, [notifications, shouldDisplay, isNotificationExpired]);

	// Update stats to respect filtered notifications
	const filteredStats = useMemo(() => {
		return {
			total: filteredNotifications.length,
			unread: filteredNotifications.filter((n) => !n.read).length,
			dismissed: stats.dismissed,
			byType: "byType" in stats ? stats.byType : {},
		};
	}, [filteredNotifications, stats]);

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Notifications"
				description="The notifications page requires a desktop screen to function properly."
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

	const handleMarkRead = async (notificationId: string) => {
		try {
			await markReadMutation.mutateAsync({ notificationId });
			queryClient.invalidateQueries({
				queryKey: orpc.admin.notifications.list.key(),
			});
			toast.success("Marked as read");
		} catch (_error) {
			toast.error("Failed to mark notification as read");
		}
	};

	const handleMarkAllRead = async () => {
		const toastId = toast.loading("Marking all as read...");
		try {
			await markAllReadMutation.mutateAsync({});
			toast.success("All notifications marked as read", { id: toastId });
			queryClient.invalidateQueries({
				queryKey: orpc.admin.notifications.list.key(),
			});
		} catch (_error) {
			toast.error("Failed to mark all as read", { id: toastId });
		}
	};

	const handleDismiss = async (notificationId: string) => {
		try {
			await dismissMutation.mutateAsync({ notificationId });
			queryClient.invalidateQueries({
				queryKey: orpc.admin.notifications.list.key(),
			});
			toast.success("Notification dismissed");
		} catch (_error) {
			toast.error("Failed to dismiss notification");
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-10 w-64 bg-muted animate-pulse rounded" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{[...Array(3)].map((_, i) => (
						<Card key={i} className="p-6">
							<div className="h-20 bg-muted animate-pulse rounded" />
						</Card>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Page Title */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-balance">
						Notifications
					</h1>
					<p className="text-muted-foreground mt-2">
						Stay updated on subscriptions, payments, and system
						events
					</p>
				</div>
				<Button
					variant="outline"
					onClick={() => router.push("/admin/notifications/settings")}
				>
					<Settings className="h-4 w-4 mr-2" />
					Settings
				</Button>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card className="p-6">
					<div className="flex items-center gap-4">
						<div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
							<Bell className="h-6 w-6 text-blue-500" />
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Total
							</p>
							<p className="text-2xl font-bold">
								{filteredStats.total}
							</p>
							<p className="text-xs text-muted-foreground">
								All notifications
							</p>
						</div>
					</div>
				</Card>

				<Card className="p-6">
					<div className="flex items-center gap-4">
						<div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
							<AlertCircle className="h-6 w-6 text-primary" />
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Unread
							</p>
							<p className="text-2xl font-bold">
								{filteredStats.unread}
							</p>
							<p className="text-xs text-muted-foreground">
								Requires attention
							</p>
						</div>
					</div>
				</Card>

				<Card className="p-6">
					<div className="flex items-center gap-4">
						<div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
							<CheckCheck className="h-6 w-6 text-green-500" />
						</div>
						<div>
							<p className="text-sm font-medium text-muted-foreground">
								Read
							</p>
							<p className="text-2xl font-bold">
								{filteredStats.total - filteredStats.unread}
							</p>
							<p className="text-xs text-muted-foreground">
								Acknowledged
							</p>
						</div>
					</div>
				</Card>
			</div>

			{/* Filters */}
			<Card className="p-4">
				<div className="flex flex-col md:flex-row gap-4">
					{/* Search */}
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search notifications..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-10 pr-10"
						/>
						{searchQuery && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setSearchQuery("")}
								className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>

					{/* Type Filter */}
					<Select
						value={typeFilter}
						onValueChange={(value: any) => setTypeFilter(value)}
					>
						<SelectTrigger className="w-[200px]">
							<Filter className="mr-2 h-4 w-4" />
							<SelectValue placeholder="All Types" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{Object.entries(notificationTypeLabels).map(
								([type, label]) => (
									<SelectItem key={type} value={type}>
										{label}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>

					{/* Read Status Filter */}
					<Select
						value={readStatusFilter}
						onValueChange={(value: any) =>
							setReadStatusFilter(value)
						}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Status</SelectItem>
							<SelectItem value="unread">Unread Only</SelectItem>
							<SelectItem value="read">Read Only</SelectItem>
						</SelectContent>
					</Select>

					{/* Mark All Read Button */}
					{filteredStats.unread > 0 && (
						<Button
							variant="outline"
							onClick={handleMarkAllRead}
							disabled={markAllReadMutation.isPending}
							className="shrink-0"
						>
							<CheckCheck className="h-4 w-4 mr-2" />
							Mark All Read
						</Button>
					)}
				</div>
			</Card>

			{/* Notifications List */}
			<Card>
				<div className="divide-y">
					{filteredNotifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 px-4">
							<Bell className="h-12 w-12 text-muted-foreground mb-4" />
							<p className="text-muted-foreground text-center">
								{searchQuery ||
								typeFilter !== "all" ||
								readStatusFilter !== "all"
									? "No notifications match your filters"
									: "No notifications yet"}
							</p>
							<p className="text-xs text-muted-foreground mt-1 text-center">
								You'll see important updates here
							</p>
						</div>
					) : (
						filteredNotifications.map((notification) => (
							<div
								key={notification.id}
								className={`p-4 hover:bg-muted/50 transition-colors ${
									!notification.read
										? "bg-primary/5 border-l-4 border-l-primary"
										: ""
								}`}
							>
								<div className="flex items-start gap-4">
									{/* Icon indicator */}
									<div
										className={`mt-1 ${notificationTypeColors[notification.type as NotificationType] || notificationTypeColors.subscription_new}`}
									>
										<Bell className="h-5 w-5" />
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0 space-y-1">
										<div className="flex items-start justify-between gap-2">
											<div className="flex-1">
												<div className="flex items-center gap-2">
													<h3 className="font-semibold text-sm">
														{notification.title}
													</h3>
													{!notification.read && (
														<div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
													)}
												</div>
												<p className="text-sm text-muted-foreground mt-1">
													{notification.message}
												</p>
												<p className="text-xs text-muted-foreground mt-2">
													{formatRelativeTime(
														notification.createdAt,
													)}
												</p>
											</div>

											{/* Actions */}
											<div className="flex items-center gap-1 flex-shrink-0">
												{notification.link && (
													<Link
														href={notification.link}
													>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
														>
															<ExternalLink className="h-4 w-4" />
															<span className="sr-only">
																View details
															</span>
														</Button>
													</Link>
												)}
												{!notification.read && (
													<Button
														variant="ghost"
														size="icon"
														className="h-8 w-8"
														onClick={() =>
															handleMarkRead(
																notification.id,
															)
														}
														disabled={
															markReadMutation.isPending
														}
													>
														<Check className="h-4 w-4" />
														<span className="sr-only">
															Mark as read
														</span>
													</Button>
												)}
												<Button
													variant="ghost"
													size="icon"
													className="h-8 w-8"
													onClick={() =>
														handleDismiss(
															notification.id,
														)
													}
													disabled={
														dismissMutation.isPending
													}
												>
													<X className="h-4 w-4" />
													<span className="sr-only">
														Dismiss
													</span>
												</Button>
											</div>
										</div>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</Card>
		</div>
	);
}
