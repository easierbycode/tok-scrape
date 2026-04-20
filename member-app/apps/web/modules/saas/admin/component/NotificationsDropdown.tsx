"use client";

import { useNotificationSettings } from "@saas/admin/hooks/use-notification-settings";
import { formatRelativeTime } from "@saas/admin/lib/subscription-utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, Settings, X } from "@/modules/ui/icons";

export function NotificationsDropdown() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const { shouldShowInBadge, shouldDisplay, isNotificationExpired } =
		useNotificationSettings();

	const notificationsQueryKey = orpc.admin.notifications.list.key();

	const { data } = useQuery(
		orpc.admin.notifications.list.queryOptions({
			input: {
				readStatus: "all",
				dismissed: false,
				limit: 20,
				offset: 0,
			},
		}),
	);

	const markAllReadMutation = useMutation({
		...orpc.admin.notifications.markAllRead.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

	const markReadMutation = useMutation({
		...orpc.admin.notifications.markRead.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

	const dismissMutation = useMutation({
		...orpc.admin.notifications.dismiss.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

	const allNotifications = data?.notifications || [];

	const visibleNotifications = allNotifications
		.filter((n) => shouldDisplay(n.type))
		.filter((n) => !isNotificationExpired(n.createdAt))
		.slice(0, 5);

	const unreadCount = allNotifications.filter(
		(n) =>
			!n.read &&
			shouldShowInBadge(n.type) &&
			!isNotificationExpired(n.createdAt),
	).length;

	const handleViewAll = () => {
		setOpen(false);
		router.push("/admin/notifications");
	};

	const handleNotificationClick = (
		notificationId: string,
		isRead: boolean,
		link?: string,
	) => {
		if (!isRead) {
			markReadMutation.mutate({ notificationId });
		}
		if (link) {
			setOpen(false);
			router.push(link);
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="relative">
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
							{unreadCount}
						</span>
					)}
					<span className="sr-only">Notifications</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-96 p-0">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h3 className="font-semibold text-sm">Notifications</h3>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto p-0 text-xs hover:text-primary"
							disabled={markAllReadMutation.isPending}
							onClick={() => markAllReadMutation.mutate({})}
						>
							<CheckCheck className="h-3 w-3 mr-1" />
							Mark all read
						</Button>
					)}
				</div>
				<div className="max-h-[400px] overflow-y-auto">
					{visibleNotifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center px-4">
							<Bell className="h-12 w-12 text-muted-foreground mb-2" />
							<p className="text-sm text-muted-foreground">
								No notifications
							</p>
							<p className="text-xs text-muted-foreground mt-1">
								You'll see important updates here
							</p>
						</div>
					) : (
						<div className="divide-y">
							{visibleNotifications.map((notification) => (
								// biome-ignore lint/a11y/useSemanticElements: Cannot use native <button> because row contains a nested dismiss <button>; nested buttons are invalid HTML.
								<div
									key={notification.id}
									role="button"
									tabIndex={0}
									className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
										!notification.read ? "bg-primary/5" : ""
									}`}
									onClick={() =>
										handleNotificationClick(
											notification.id,
											notification.read,
											notification.link,
										)
									}
									onKeyDown={(e) => {
										if (
											e.key === "Enter" ||
											e.key === " "
										) {
											e.preventDefault();
											handleNotificationClick(
												notification.id,
												notification.read,
												notification.link,
											);
										}
									}}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex-1 space-y-1 min-w-0">
											<div className="flex items-center gap-2">
												<p className="text-sm font-medium truncate">
													{notification.title}
												</p>
												{!notification.read && (
													<div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
												)}
											</div>
											<p className="text-xs text-muted-foreground line-clamp-2">
												{notification.message}
											</p>
											<p className="text-xs text-muted-foreground">
												{formatRelativeTime(
													notification.createdAt,
												)}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 flex-shrink-0 hover:bg-muted"
											disabled={dismissMutation.isPending}
											onClick={(e) => {
												e.stopPropagation();
												dismissMutation.mutate({
													notificationId:
														notification.id,
												});
											}}
										>
											<X className="h-3 w-3" />
											<span className="sr-only">
												Dismiss
											</span>
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
				<div className="border-t p-2 space-y-1">
					<Button
						variant="ghost"
						className="w-full justify-center text-xs h-9 hover:bg-muted"
						onClick={() => {
							setOpen(false);
							router.push("/admin/notifications/settings");
						}}
					>
						<Settings className="h-3 w-3 mr-2" />
						Settings
					</Button>
					<Button
						variant="ghost"
						className="w-full justify-center text-xs h-9 hover:bg-muted"
						onClick={handleViewAll}
					>
						View all notifications
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
