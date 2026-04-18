"use client";

import { BADGE_COLORS } from "@saas/admin/lib/constants";
import { Badge } from "@ui/components/badge";
import type React from "react";
import {
	AlertCircle,
	AlertTriangle,
	Bell,
	Calendar,
	CheckCircle,
	Clock,
	DollarSign,
	Eye,
	Gift,
	Info,
	Megaphone,
	MessageSquare,
	Settings,
	Shield,
	Trash2,
	UserPlus,
	XCircle,
} from "@/modules/ui/icons";

interface SubscriptionStatusBadgeProps {
	status:
		| "active"
		| "trial"
		| "free"
		| "inactive"
		| "cancelled"
		| "grace_period"
		| "scheduled_cancel"
		| "none"
		| "manual"
		| "trialing"
		| "past_due"
		| "lifetime";
}

export function SubscriptionStatusBadge({
	status,
}: SubscriptionStatusBadgeProps) {
	const config = {
		active: {
			icon: CheckCircle,
			label: "Active",
			className: BADGE_COLORS.subscription.active,
		},
		trial: {
			icon: Clock,
			label: "Trial",
			className: BADGE_COLORS.subscription.trial,
		},
		trialing: {
			icon: Clock,
			label: "Trialing",
			className: BADGE_COLORS.subscription.trialing,
		},
		free: {
			icon: Gift,
			label: "Free Access",
			className: BADGE_COLORS.subscription.free,
		},
		inactive: {
			icon: XCircle,
			label: "Inactive",
			className: BADGE_COLORS.subscription.inactive,
		},
		cancelled: {
			icon: XCircle,
			label: "Cancelled",
			className: BADGE_COLORS.subscription.cancelled,
		},
		grace_period: {
			icon: Clock,
			label: "Grace Period",
			className: BADGE_COLORS.subscription.grace_period,
		},
		scheduled_cancel: {
			icon: Calendar,
			label: "Scheduled cancel",
			className: BADGE_COLORS.subscription.scheduled_cancel,
		},
		past_due: {
			icon: XCircle,
			label: "Past Due",
			className: BADGE_COLORS.subscription.past_due,
		},
		none: {
			icon: AlertCircle,
			label: "No Subscription",
			className: BADGE_COLORS.subscription.none,
		},
		manual: {
			icon: Gift,
			label: "Manual Access",
			className: BADGE_COLORS.subscription.manual,
		},
		lifetime: {
			icon: CheckCircle,
			label: "Lifetime",
			className: BADGE_COLORS.subscription.lifetime,
		},
	};

	const statusConfig = config[status] || {
		icon: AlertCircle,
		label: status,
		className: BADGE_COLORS.subscription.none,
	};

	const { icon: Icon, label, className } = statusConfig;

	return (
		<Badge className={className}>
			<Icon className="mr-1 h-3 w-3" />
			{label}
		</Badge>
	);
}

interface RoleBadgeProps {
	role: string | null | undefined;
}

export function RoleBadge({ role }: RoleBadgeProps) {
	if (!role || role === "user") {
		return null;
	}

	const label =
		{
			owner: "Owner",
			admin: "Admin",
			analytics_viewer: "Analytics",
			support: "Support",
		}[role] ?? role;

	const className =
		role in BADGE_COLORS.role
			? BADGE_COLORS.role[role as keyof typeof BADGE_COLORS.role]
			: BADGE_COLORS.role.admin;

	return (
		<Badge className={className}>
			<Shield className="mr-1 h-3 w-3" />
			{label}
		</Badge>
	);
}

interface DiscordBadgeProps {
	isConnected: boolean;
}

export function DiscordBadge({ isConnected }: DiscordBadgeProps) {
	if (!isConnected) {
		return null;
	}

	return <Badge className={BADGE_COLORS.discord.connected}>Connected</Badge>;
}

interface AnnouncementStatusBadgeProps {
	status: "published" | "draft";
}

export function AnnouncementStatusBadge({
	status,
}: AnnouncementStatusBadgeProps) {
	const config = {
		published: {
			icon: Eye,
			label: "Published",
			className: BADGE_COLORS.announcement.published,
		},
		draft: {
			icon: AlertCircle,
			label: "Draft",
			className: BADGE_COLORS.announcement.draft,
		},
	};

	const { icon: Icon, label, className } = config[status];

	return (
		<Badge className={className}>
			<Icon className="mr-1 h-3 w-3" />
			{label}
		</Badge>
	);
}

interface AnnouncementTypeBadgeProps {
	type: string;
}

export function AnnouncementTypeBadge({ type }: AnnouncementTypeBadgeProps) {
	const config: Record<
		string,
		{
			icon: any;
			label: string;
			className: string;
		}
	> = {
		welcome: {
			icon: Bell,
			label: "Welcome",
			className: BADGE_COLORS.announcement.welcome,
		},
		feature: {
			icon: Megaphone,
			label: "Feature",
			className: BADGE_COLORS.announcement.feature,
		},
		event: {
			icon: Calendar,
			label: "Event",
			className: BADGE_COLORS.announcement.event,
		},
		maintenance: {
			icon: Settings,
			label: "Maintenance",
			className: BADGE_COLORS.announcement.maintenance,
		},
		community: {
			icon: MessageSquare,
			label: "Community",
			className: BADGE_COLORS.announcement.community,
		},
	};

	const {
		icon: Icon,
		label,
		className,
	} = config[type] || {
		icon: Bell,
		label: type.charAt(0).toUpperCase() + type.slice(1),
		className: BADGE_COLORS.announcement.welcome,
	};

	return (
		<Badge className={className}>
			<Icon className="mr-1 h-3 w-3" />
			{label}
		</Badge>
	);
}

interface PriorityBadgeProps {
	priority: "low" | "medium" | "high" | "urgent";
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
	const config = {
		low: {
			label: "Low",
			className: BADGE_COLORS.priority.low,
		},
		medium: {
			label: "Medium",
			className: BADGE_COLORS.priority.medium,
		},
		high: {
			label: "High",
			className: BADGE_COLORS.priority.high,
		},
		urgent: {
			label: "Urgent",
			className: BADGE_COLORS.priority.urgent,
		},
	};

	const { label, className } = config[priority];

	return <Badge className={className}>{label}</Badge>;
}

interface AffiliateStatusBadgeProps {
	/** Rewardful affiliate state: active | disabled | suspicious */
	status: "active" | "disabled" | "suspicious";
}

export function AffiliateStatusBadge({ status }: AffiliateStatusBadgeProps) {
	const config: Record<
		string,
		{ icon: React.ElementType; label: string; className: string }
	> = {
		active: {
			icon: CheckCircle,
			label: "Active",
			className: BADGE_COLORS.affiliate.active,
		},
		disabled: {
			icon: XCircle,
			label: "Disabled",
			className: BADGE_COLORS.affiliate.inactive,
		},
		suspicious: {
			icon: AlertTriangle,
			label: "Suspicious",
			className:
				"border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
		},
	};

	const statusConfig = config[status] ?? config.disabled;
	const { icon: Icon, label, className } = statusConfig;

	return (
		<Badge className={className}>
			<Icon className="mr-1 h-3 w-3" />
			{label}
		</Badge>
	);
}

interface AuditActionBadgeProps {
	action: string;
}

export function AuditActionBadge({ action }: AuditActionBadgeProps) {
	const getActionConfig = (action: string) => {
		const actionLower = action.toLowerCase();

		if (actionLower.includes("grant") || actionLower.includes("access")) {
			return {
				icon: UserPlus,
				className: BADGE_COLORS.audit.grant,
			};
		}
		if (actionLower.includes("revoke") || actionLower.includes("remove")) {
			return {
				icon: Trash2,
				className: BADGE_COLORS.audit.revoke,
			};
		}
		if (actionLower.includes("role") || actionLower.includes("admin")) {
			return {
				icon: Shield,
				className: BADGE_COLORS.audit.role,
			};
		}
		if (
			actionLower.includes("subscription") ||
			actionLower.includes("billing")
		) {
			return {
				icon: DollarSign,
				className: BADGE_COLORS.audit.subscription,
			};
		}
		if (actionLower.includes("update") || actionLower.includes("edit")) {
			return {
				icon: Settings,
				className: BADGE_COLORS.audit.update,
			};
		}
		if (actionLower.includes("create") || actionLower.includes("add")) {
			return {
				icon: UserPlus,
				className: BADGE_COLORS.audit.create,
			};
		}
		if (actionLower.includes("delete")) {
			return {
				icon: Trash2,
				className: BADGE_COLORS.audit.delete,
			};
		}

		return {
			icon: Info,
			className: BADGE_COLORS.audit.other,
		};
	};

	const { icon: Icon, className } = getActionConfig(action);

	return (
		<Badge className={className}>
			<Icon className="mr-1 h-3 w-3" />
			{action}
		</Badge>
	);
}
