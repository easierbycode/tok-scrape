export type NotificationType =
	| "subscription_new"
	| "subscription_cancelled"
	| "payment_failed"
	| "payment_recovered"
	| "trial_expiring"
	| "grace_period_ending"
	| "manual_access_granted"
	| "role_changed"
	| "announcement_published"
	| "affiliate_status_changed"
	| "discord_connection_failed"
	| "system_alert"
	| "global_announcement";

export const notificationTypeLabels: Record<NotificationType, string> = {
	subscription_new: "New Subscription",
	subscription_cancelled: "Subscription Cancelled",
	payment_failed: "Payment Failed",
	payment_recovered: "Payment Recovered",
	trial_expiring: "Trial Expiring",
	grace_period_ending: "Grace Period Ending",
	manual_access_granted: "Manual Access",
	role_changed: "Role Changed",
	announcement_published: "Announcement",
	affiliate_status_changed: "Affiliate Update",
	discord_connection_failed: "Discord Issue",
	system_alert: "System Alert",
	global_announcement: "Global Announcements",
};

export const notificationTypeColors: Record<NotificationType, string> = {
	subscription_new: "text-green-500",
	subscription_cancelled: "text-red-500",
	payment_failed: "text-amber-500",
	payment_recovered: "text-green-500",
	trial_expiring: "text-purple-500",
	grace_period_ending: "text-amber-500",
	manual_access_granted: "text-blue-500",
	role_changed: "text-indigo-500",
	announcement_published: "text-blue-500",
	affiliate_status_changed: "text-emerald-500",
	discord_connection_failed: "text-red-500",
	system_alert: "text-orange-500",
	global_announcement: "text-orange-500",
};
