"use client";

import { formatRelativeTime } from "@saas/admin/lib/subscription-utils";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { ScrollArea } from "@ui/components/scroll-area";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, X } from "@/modules/ui/icons";

export function UserNotificationsDropdown() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);

	const notificationsQueryKey = orpc.users.notifications.list.key();

	const { data } = useQuery(
		orpc.users.notifications.list.queryOptions({
			input: {
				readStatus: "all",
				dismissed: false,
				limit: 5,
				offset: 0,
			},
		}),
	);

	const notifications = data?.notifications || [];
	const unreadCount = data?.stats?.unread || 0;

	const markAllReadMutation = useMutation({
		...orpc.users.notifications.markAllRead.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

	const markReadMutation = useMutation({
		...orpc.users.notifications.markRead.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

	const dismissMutation = useMutation({
		...orpc.users.notifications.dismiss.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: notificationsQueryKey });
		},
	});

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
						<span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
							{unreadCount}
						</span>
					)}
					<span className="sr-only">Notifications</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[calc(100vw-1rem)] sm:w-96 p-0"
			>
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
				<ScrollArea className="max-h-[400px]">
					{notifications.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12 text-center px-4">
							<Bell className="h-12 w-12 text-muted-foreground mb-2" />
							<p className="text-sm text-muted-foreground">
								No notifications
							</p>
						</div>
					) : (
						<div className="divide-y">
							{notifications.map((notification) => (
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
				</ScrollArea>
				<div className="border-t p-2">
					<Button
						variant="ghost"
						className="w-full justify-center text-xs h-9 hover:bg-muted"
						onClick={() => {
							setOpen(false);
							router.push("/app/notifications");
						}}
					>
						View all notifications
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
