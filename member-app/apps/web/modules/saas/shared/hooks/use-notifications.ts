import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";

export function useNotifications() {
	return useQuery(
		orpc.users.notifications.list.queryOptions({
			input: {
				readStatus: "unread",
				dismissed: false,
				limit: 10,
			},
		}),
	);
}

export function useUnreadNotificationCount() {
	const { data } = useNotifications();
	return data?.stats?.unread || 0;
}
