import { completeOnboarding } from "./procedures/complete-onboarding";
import { createAffiliate } from "./procedures/affiliate/create";
import { getDashboardLink } from "./procedures/affiliate/get-dashboard-link";
import { lookupAffiliate } from "./procedures/affiliate/lookup";
import { refreshAffiliateLink } from "./procedures/affiliate/refresh-link";
import { refreshAffiliateStats } from "./procedures/affiliate/refresh-stats";
import { getAffiliateStatus } from "./procedures/affiliate/status";
import { createAvatarUploadUrl } from "./procedures/create-avatar-upload-url";
import { grantDiscordAccess } from "./procedures/discord/grant-access";
import {
	dismissNotification,
	markAllNotificationsAsRead,
	markNotificationAsRead,
} from "./procedures/notifications/actions";
import { listUserNotifications } from "./procedures/notifications/list";
import { setupAccount } from "./procedures/setup-account";
import { updateNotificationEmail } from "./procedures/update-notification-email";
import { validateSetupToken } from "./procedures/validate-setup-token";

export const usersRouter = {
	avatarUploadUrl: createAvatarUploadUrl,
	affiliate: {
		status: getAffiliateStatus,
		create: createAffiliate,
		lookup: lookupAffiliate,
		getDashboardLink: getDashboardLink,
		refreshLink: refreshAffiliateLink,
		refreshStats: refreshAffiliateStats,
	},
	discord: {
		grantAccess: grantDiscordAccess,
	},
	notifications: {
		list: listUserNotifications,
		markRead: markNotificationAsRead,
		markAllRead: markAllNotificationsAsRead,
		dismiss: dismissNotification,
	},
	completeOnboarding,
	setupAccount,
	updateNotificationEmail,
	validateSetupToken,
};
