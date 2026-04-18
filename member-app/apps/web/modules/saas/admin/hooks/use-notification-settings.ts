"use client";

import type { NotificationType } from "@repo/api/modules/admin/types/notification-types";
import { logger } from "@repo/logs";
import { useEffect, useState } from "react";

export interface NotificationSettings {
	// Badge preferences - which types contribute to badge count
	badgeTypes: Record<NotificationType, boolean>;

	// Display preferences - which types show in list
	displayTypes: Record<NotificationType, boolean>;

	// Auto-dismiss settings
	autoDismissDays: number | null; // null = never
}

const DEFAULT_SETTINGS: NotificationSettings = {
	badgeTypes: {
		subscription_new: true,
		subscription_cancelled: true,
		payment_failed: true,
		payment_recovered: true,
		trial_expiring: true,
		grace_period_ending: true,
		manual_access_granted: true,
		role_changed: true,
		announcement_published: true,
		affiliate_status_changed: true,
		discord_connection_failed: true,
		system_alert: true,
		global_announcement: true,
	},
	displayTypes: {
		subscription_new: true,
		subscription_cancelled: true,
		payment_failed: true,
		payment_recovered: true,
		trial_expiring: true,
		grace_period_ending: true,
		manual_access_granted: true,
		role_changed: true,
		announcement_published: true,
		affiliate_status_changed: true,
		discord_connection_failed: true,
		system_alert: true,
		global_announcement: true,
	},
	autoDismissDays: 30,
};

const STORAGE_KEY = "admin_notification_settings";

export function useNotificationSettings() {
	const [settings, setSettings] =
		useState<NotificationSettings>(DEFAULT_SETTINGS);
	const [isLoaded, setIsLoaded] = useState(false);

	// Load settings from localStorage on mount
	useEffect(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				setSettings(parsed);
			}
		} catch (error) {
			logger.error("Failed to load notification settings", { error });
		} finally {
			setIsLoaded(true);
		}
	}, []);

	// Save settings to localStorage
	const saveSettings = (newSettings: NotificationSettings) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
			setSettings(newSettings);
		} catch (error) {
			logger.error("Failed to save notification settings", { error });
		}
	};

	// Helper: Check if notification should show in badge
	const shouldShowInBadge = (type: NotificationType): boolean => {
		return settings.badgeTypes[type] ?? true;
	};

	// Helper: Check if notification should display in list
	const shouldDisplay = (type: NotificationType): boolean => {
		return settings.displayTypes[type] ?? true;
	};

	// Helper: Check if notification is too old (should be auto-dismissed)
	const isNotificationExpired = (createdAt: string): boolean => {
		if (settings.autoDismissDays === null) {
			return false;
		}

		const notificationDate = new Date(createdAt);
		const expiryDate = new Date();
		expiryDate.setDate(expiryDate.getDate() - settings.autoDismissDays);

		return notificationDate < expiryDate;
	};

	// Update individual badge type setting
	const updateBadgeType = (type: NotificationType, enabled: boolean) => {
		saveSettings({
			...settings,
			badgeTypes: {
				...settings.badgeTypes,
				[type]: enabled,
			},
		});
	};

	// Update individual display type setting
	const updateDisplayType = (type: NotificationType, enabled: boolean) => {
		saveSettings({
			...settings,
			displayTypes: {
				...settings.displayTypes,
				[type]: enabled,
			},
		});
	};

	// Update auto-dismiss days
	const updateAutoDismissDays = (days: number | null) => {
		saveSettings({
			...settings,
			autoDismissDays: days,
		});
	};

	// Reset to defaults
	const resetToDefaults = () => {
		saveSettings(DEFAULT_SETTINGS);
	};

	return {
		settings,
		isLoaded,
		saveSettings,
		shouldShowInBadge,
		shouldDisplay,
		isNotificationExpired,
		updateBadgeType,
		updateDisplayType,
		updateAutoDismissDays,
		resetToDefaults,
	};
}

// TODO: Week 4 Migration
// 1. Create database table: adminNotificationSettings
// 2. Create ORPC procedures: getSettings, updateSettings
// 3. Replace localStorage calls with ORPC mutations
// 4. Migrate existing localStorage settings to database on first load
