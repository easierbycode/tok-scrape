"use client";

import { formatRelativeTime } from "@saas/admin/lib/subscription-utils";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import { Bell } from "@/modules/ui/icons";

export default function NotificationsPage() {
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		orpc.users.notifications.list.queryOptions({
			input: {
				readStatus: "all",
				dismissed: false,
				limit: 50,
				offset: 0,
			},
		}),
	);

	const markAllReadMutation = useMutation({
		...orpc.users.notifications.markAllRead.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.users.notifications.list.key(),
			});
		},
	});

	const notifications = data?.notifications || [];
	const unreadCount = data?.stats?.unread || 0;

	return (
		<>
			<PageHeader
				title="Notifications"
				subtitle="View all your notifications and updates"
			/>

			{unreadCount > 0 && (
				<div className="flex justify-end mb-4">
					<Button
						variant="outline"
						size="sm"
						onClick={() => markAllReadMutation.mutate({})}
					>
						Mark all as read
					</Button>
				</div>
			)}

			<div className="py-6 space-y-4">
				{isLoading ? (
					<Card>
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground">Loading...</p>
						</CardContent>
					</Card>
				) : notifications.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
							<h3 className="font-serif font-semibold tracking-tight text-lg text-foreground">
								No notifications yet
							</h3>
						</CardContent>
					</Card>
				) : (
					notifications.map((notification) => (
						<Card
							key={notification.id}
							className={
								!notification.read ? "border-primary/50" : ""
							}
						>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<CardTitle className="text-base">
												{notification.title}
											</CardTitle>
											{!notification.read && (
												<div className="h-2 w-2 rounded-full bg-primary" />
											)}
										</div>
										<p className="text-sm text-muted-foreground mt-1">
											{formatRelativeTime(
												notification.createdAt,
											)}
										</p>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm">
									{notification.message}
								</p>
							</CardContent>
						</Card>
					))
				)}
			</div>
		</>
	);
}
