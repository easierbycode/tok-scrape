/**
 * Shared constants for the admin dashboard
 * Consolidates magic numbers and strings
 */

export const MOBILE_BREAKPOINT = 1024;

export const BADGE_COLORS = {
	subscription: {
		active: "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20",
		trial: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20",
		free: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
		inactive:
			"bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20",
		cancelled:
			"bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20",
		grace_period:
			"bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
		scheduled_cancel:
			"bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border-orange-500/20",
		none: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20",
		manual: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
		trialing:
			"bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20",
		past_due:
			"bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20",
		lifetime:
			"bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border-violet-500/20",
	},
	role: {
		owner: "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/20",
		admin: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20",
		analytics_viewer:
			"bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border-sky-500/20",
		support:
			"bg-teal-500/10 text-teal-600 dark:text-teal-400 hover:bg-teal-500/20 border-teal-500/20",
	},
	discord: {
		connected:
			"bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-indigo-500/20",
	},
	announcement: {
		published:
			"bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20",
		draft: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20",
		welcome: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		feature: "bg-purple-500/10 text-purple-500 border-purple-500/20",
		event: "bg-amber-500/10 text-amber-500 border-amber-500/20",
		maintenance: "bg-red-500/10 text-red-500 border-red-500/20",
		community: "bg-green-500/10 text-green-500 border-green-500/20",
	},
	priority: {
		low: "bg-gray-500/10 text-gray-500 hover:bg-gray-500/20",
		medium: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
		high: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
		urgent: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
		normal: "bg-blue-500",
		important: "bg-amber-500",
	},
	affiliate: {
		active: "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20",
		inactive:
			"bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 border-gray-500/20",
	},
	audit: {
		grant: "bg-green-500/10 text-green-500 border-green-500/20",
		revoke: "bg-red-500/10 text-red-500 border-red-500/20",
		role: "bg-purple-500/10 text-purple-500 border-purple-500/20",
		subscription: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		update: "bg-amber-500/10 text-amber-500 border-amber-500/20",
		create: "bg-green-500/10 text-green-500 border-green-500/20",
		delete: "bg-red-500/10 text-red-500 border-red-500/20",
		other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
		grant_access: "bg-green-500/10 text-green-500 border-green-500/20",
		revoke_access: "bg-red-500/10 text-red-500 border-red-500/20",
		role_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		user_delete: "bg-red-500/10 text-red-500 border-red-500/20",
		subscription_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		announcement_create:
			"bg-green-500/10 text-green-500 border-green-500/20",
		announcement_update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		announcement_delete: "bg-red-500/10 text-red-500 border-red-500/20",
		content_modify: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		system_config: "bg-amber-500/10 text-amber-500 border-amber-500/20",
	},
	action: {
		grant_access: "bg-green-500/10 text-green-500 border-green-500/20",
		revoke_access: "bg-red-500/10 text-red-500 border-red-500/20",
		role_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		user_delete: "bg-red-500/10 text-red-500 border-red-500/20",
		subscription_change: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		announcement_create:
			"bg-green-500/10 text-green-500 border-green-500/20",
		announcement_update: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		announcement_delete: "bg-red-500/10 text-red-500 border-red-500/20",
		content_modify: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		system_config: "bg-amber-500/10 text-amber-500 border-amber-500/20",
	},
};

export const DATE_FILTER_OPTIONS = [
	{ value: "all", label: "All Time" },
	{ value: "7", label: "Last 7 Days" },
	{ value: "30", label: "Last 30 Days" },
	{ value: "90", label: "Last 90 Days" },
	{ value: "365", label: "Last Year" },
	{ value: "custom", label: "Custom Range..." },
];
