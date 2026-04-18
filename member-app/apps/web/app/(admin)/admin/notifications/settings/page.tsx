"use client";

import {
	type NotificationType,
	notificationTypeLabels,
} from "@repo/api/modules/admin/types/notification-types";
import { ViewOnDesktop } from "@saas/admin/component/ViewOnDesktop";
import { useNotificationSettings } from "@saas/admin/hooks/use-notification-settings";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Label } from "@ui/components/label";
import { RadioGroup, RadioGroupItem } from "@ui/components/radio-group";
import { Switch } from "@ui/components/switch";
import { useIsMobile } from "@ui/hooks/use-mobile";
import { toast } from "sonner";
import { AlertCircle, RefreshCw, Settings } from "@/modules/ui/icons";

// Group notification types for better UX
const NOTIFICATION_GROUPS = {
	critical: {
		title: "Critical Notifications",
		description:
			"High-priority notifications that require immediate attention",
		types: [
			"payment_failed",
			"grace_period_ending",
			"system_alert",
			"global_announcement",
		] as NotificationType[],
	},
	subscriptions: {
		title: "Subscription Events",
		description: "User subscription and trial activity",
		types: [
			"subscription_new",
			"subscription_cancelled",
			"payment_recovered",
			"trial_expiring",
		] as NotificationType[],
	},
	adminActions: {
		title: "Admin Actions",
		description: "Actions performed by administrators",
		types: [
			"manual_access_granted",
			"role_changed",
			"announcement_published",
			"affiliate_status_changed",
		] as NotificationType[],
	},
	system: {
		title: "System Events",
		description: "Platform and integration events",
		types: ["discord_connection_failed"] as NotificationType[],
	},
};

export default function NotificationSettingsPage() {
	const isMobile = useIsMobile();
	const {
		settings,
		isLoaded,
		updateBadgeType,
		updateDisplayType,
		updateAutoDismissDays,
		resetToDefaults,
	} = useNotificationSettings();

	// Mobile redirect
	if (isMobile) {
		return (
			<ViewOnDesktop
				title="Notification Settings"
				description="The notification settings page requires a desktop screen to function properly."
			/>
		);
	}

	if (!isLoaded) {
		return (
			<div className="space-y-6">
				<div className="h-10 w-64 bg-muted animate-pulse rounded" />
				<Card className="p-6">
					<div className="h-96 bg-muted animate-pulse rounded" />
				</Card>
			</div>
		);
	}

	const handleReset = () => {
		resetToDefaults();
		toast.success("Settings reset to defaults");
	};

	return (
		<div className="space-y-6">
			{/* Page Title */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">
						Notification Settings
					</h1>
					<p className="text-muted-foreground mt-2">
						Control which notifications you see and how they're
						displayed
					</p>
				</div>
				<Button variant="outline" onClick={handleReset}>
					<RefreshCw className="h-4 w-4 mr-2" />
					Reset to Defaults
				</Button>
			</div>

			{/* Info Alert about Global Announcements */}
			<Alert className="border-blue-500/50 bg-blue-500/10">
				<AlertCircle className="h-4 w-4 text-blue-500" />
				<AlertDescription className="text-sm">
					<strong>Global Announcements:</strong> When disabled, you
					won't see site-wide or onboarding welcome popups. Other
					admins will still see them unless they also disable this
					setting.
				</AlertDescription>
			</Alert>

			{/* Warning Alert */}
			{(Object.values(settings.badgeTypes).every((v) => !v) ||
				Object.values(settings.displayTypes).every((v) => !v)) && (
				<Alert
					variant="error"
					className="border-amber-500/50 bg-amber-500/10"
				>
					<AlertCircle className="h-4 w-4 text-amber-500" />
					<AlertDescription className="text-sm">
						{Object.values(settings.badgeTypes).every((v) => !v) &&
							"You've disabled all notification types in the badge. You won't see any unread count. "}
						{Object.values(settings.displayTypes).every(
							(v) => !v,
						) &&
							"You've disabled all notification types in the list. Your notifications page will be empty."}
					</AlertDescription>
				</Alert>
			)}

			{/* Badge Preferences */}
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<h2 className="text-xl font-semibold flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Badge Preferences
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Choose which notification types contribute to the
							unread badge count
						</p>
					</div>

					{Object.entries(NOTIFICATION_GROUPS).map(([key, group]) => (
						<div key={key} className="space-y-3">
							<div>
								<h3 className="font-medium text-sm">
									{group.title}
								</h3>
								<p className="text-xs text-muted-foreground">
									{group.description}
								</p>
							</div>
							<div className="space-y-2 ml-4">
								{group.types.map((type) => (
									<div
										key={type}
										className="flex items-center justify-between py-2"
									>
										<Label
											htmlFor={`badge-${type}`}
											className="cursor-pointer"
										>
											{notificationTypeLabels[type]}
										</Label>
										<Switch
											id={`badge-${type}`}
											checked={settings.badgeTypes[type]}
											onCheckedChange={(checked) =>
												updateBadgeType(type, checked)
											}
										/>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</Card>

			{/* Display Preferences */}
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<h2 className="text-xl font-semibold flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Display Preferences
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Choose which notification types appear in your
							notification list
						</p>
					</div>

					{Object.entries(NOTIFICATION_GROUPS).map(([key, group]) => (
						<div key={key} className="space-y-3">
							<div>
								<h3 className="font-medium text-sm">
									{group.title}
								</h3>
								<p className="text-xs text-muted-foreground">
									{group.description}
								</p>
							</div>
							<div className="space-y-2 ml-4">
								{group.types.map((type) => (
									<div
										key={type}
										className="flex items-center justify-between py-2"
									>
										<Label
											htmlFor={`display-${type}`}
											className="cursor-pointer"
										>
											{notificationTypeLabels[type]}
										</Label>
										<Switch
											id={`display-${type}`}
											checked={
												settings.displayTypes[type]
											}
											onCheckedChange={(checked) =>
												updateDisplayType(type, checked)
											}
										/>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</Card>

			{/* Auto-Dismiss Settings */}
			<Card className="p-6">
				<div className="space-y-4">
					<div>
						<h2 className="text-xl font-semibold flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Auto-Dismiss
						</h2>
						<p className="text-sm text-muted-foreground mt-1">
							Automatically hide notifications older than the
							selected time period
						</p>
					</div>

					<RadioGroup
						value={settings.autoDismissDays?.toString() ?? "never"}
						onValueChange={(value) => {
							const days =
								value === "never"
									? null
									: Number.parseInt(value, 10);
							updateAutoDismissDays(days);
						}}
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="never" id="never" />
							<Label htmlFor="never" className="cursor-pointer">
								Never - Keep all notifications
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="7" id="7days" />
							<Label htmlFor="7days" className="cursor-pointer">
								7 days - Hide notifications older than 1 week
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="30" id="30days" />
							<Label htmlFor="30days" className="cursor-pointer">
								30 days - Hide notifications older than 1 month
								(Recommended)
							</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value="90" id="90days" />
							<Label htmlFor="90days" className="cursor-pointer">
								90 days - Hide notifications older than 3 months
							</Label>
						</div>
					</RadioGroup>
				</div>
			</Card>
		</div>
	);
}
