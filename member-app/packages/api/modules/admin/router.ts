import { helpCenterRouter } from "../help-center/router";
import { marketingRouter } from "../marketing/router";
import { testimonialsRouter } from "../testimonials/router";
import * as affiliates from "./procedures/affiliates";
import { lifecycle as analyticsLifecycle } from "./procedures/analytics/lifecycle";
import { revenue as analyticsRevenue } from "./procedures/analytics/revenue";
import * as announcements from "./procedures/announcements";
import * as auditLog from "./procedures/audit-log";
import {
	addUserToBeta,
	listAvailableFeatures,
	listBetaTesters,
	updateBetaFeature,
	updateUserBetaFeatures,
} from "./procedures/beta-features/manage";
import { snapshot as commandCenterSnapshot } from "./procedures/command-center/snapshot";
import * as discord from "./procedures/discord";
import { findOrganization } from "./procedures/find-organization";
import * as globalAnnouncements from "./procedures/global-announcements";
import { listOrganizations } from "./procedures/list-organizations";
import { listUsers } from "./procedures/list-users";
import * as notifications from "./procedures/notifications";
import { rewardfulRouter } from "./procedures/rewardful/router";
import { applyCoupon } from "./procedures/subscriptions/apply-coupon";
import { applyCredit } from "./procedures/subscriptions/apply-credit";
import { cancelSubscription } from "./procedures/subscriptions/cancel";
import { changePlan } from "./procedures/subscriptions/change-plan";
import { convertTrial } from "./procedures/subscriptions/convert-trial";
import { extendTrial } from "./procedures/subscriptions/extend-trial";
import { fetchUnlinked } from "./procedures/subscriptions/fetch-unlinked";
import { importFromStripe } from "./procedures/subscriptions/import-from-stripe";
import { listCoupons } from "./procedures/subscriptions/list-coupons";
import { manageFreeAccess } from "./procedures/subscriptions/manage-free-access";
import { subscriptionsOverview } from "./procedures/subscriptions/overview";
import { reactivateSubscription } from "./procedures/subscriptions/reactivate";
import { syncStripe } from "./procedures/subscriptions/sync-stripe";
import * as users from "./procedures/users";

export const adminRouter = {
	users: {
		list: listUsers,
		grantAccess: users.grantAccess,
		revokeAccess: users.revokeAccess,
		assignRole: users.assignRole,
		addUser: users.addUser,
		resendSetupAccountEmail: users.resendSetupAccountEmail,
		deleteUser: users.deleteUser,
		exportUserData: users.exportUserDataProcedure,
		restoreUser: users.restoreUserProcedure,
		listPendingDeletions: users.listPendingDeletions,
		listFinancialRetention: users.listFinancialRetention,
		grantFreeMonths: users.grantFreeMonths,
		changePlan: users.changePlan,
		cancelSubscription: users.cancelSubscription,
		convertToPaid: users.convertToPaid,
		impersonate: users.impersonate,
		stopImpersonation: users.stopImpersonation,
		sendDiscordInvite: users.sendDiscordInvite,
		banUserFromDiscord: users.banUserFromDiscord,
		unbanUserFromDiscord: users.unbanUserFromDiscord,
		associateDiscordAccount: users.associateDiscordAccount,
		unlinkDiscordAccount: users.unlinkDiscordAccount,
	},
	organizations: {
		list: listOrganizations,
		find: findOrganization,
	},
	subscriptions: {
		overview: subscriptionsOverview,
		listCoupons: listCoupons,
		fetchUnlinked: fetchUnlinked,
		importFromStripe: importFromStripe,
		syncStripe: syncStripe,
		applyCoupon: applyCoupon,
		applyCredit: applyCredit,
		changePlan: changePlan,
		cancel: cancelSubscription,
		extendTrial: extendTrial,
		convertTrial: convertTrial,
		manageFreeAccess: manageFreeAccess,
		reactivate: reactivateSubscription,
	},
	announcements: {
		list: announcements.list,
		create: announcements.create,
		update: announcements.update,
		delete: announcements.del,
	},
	globalAnnouncements: {
		list: globalAnnouncements.list,
		upsert: globalAnnouncements.upsert,
	},
	affiliates: {
		list: affiliates.list,
	},
	auditLog: {
		list: auditLog.list,
		create: auditLog.create,
	},
	notifications: {
		list: notifications.listNotifications,
		send: notifications.sendNotification,
		markRead: notifications.markNotificationRead,
		markAllRead: notifications.markAllNotificationsRead,
		dismiss: notifications.dismissNotification,
	},
	rewardful: rewardfulRouter,
	betaFeatures: {
		listAvailable: listAvailableFeatures,
		listTesters: listBetaTesters,
		updateFeatures: updateUserBetaFeatures,
		addUser: addUserToBeta,
		updateFeature: updateBetaFeature,
	},
	helpCenter: helpCenterRouter.admin,
	testimonials: testimonialsRouter.admin,
	marketing: marketingRouter.admin,
	analytics: {
		revenue: analyticsRevenue,
		lifecycle: analyticsLifecycle,
	},
	commandCenter: {
		snapshot: commandCenterSnapshot,
	},
	discord: {
		auditLogs: discord.getDiscordAuditLogs,
		additionalAccounts: discord.getAdditionalDiscordAccounts,
		deactivateAdditionalAccount: discord.deactivateAdditionalAccount,
		analytics: discord.getDiscordAnalytics,
		runSyncHealthCheck: discord.runSyncHealthCheck,
		addToWhitelist: discord.addToWhitelist,
		removeFromWhitelist: discord.removeFromWhitelist,
		getWhitelist: discord.getWhitelist,
		emergencyDisconnectAll: discord.emergencyDisconnectAll,
		getPendingDiscordInvites: discord.getPendingDiscordInvites,
		cancelPendingDiscordInvite: discord.cancelPendingDiscordInvite,
		resendDiscordInvite: discord.resendDiscordInvite,
		kickDiscordUser: discord.kickDiscordUser,
		syncDiscordRole: discord.syncDiscordRole,
		messageStudio: {
			listChannels: discord.listMessageStudioChannels,
			parseLink: discord.parseMessageStudioLink,
			getDiscordMessage: discord.getMessageStudioDiscordMessage,
			postMessage: discord.postMessageStudioMessage,
			patchMessage: discord.patchMessageStudioMessage,
			deleteDiscordMessage: discord.deleteMessageStudioDiscordMessage,
			listTemplates: discord.listMessageStudioTemplates,
			getTemplate: discord.getMessageStudioTemplate,
			saveTemplate: discord.saveMessageStudioTemplate,
			duplicateTemplate: discord.duplicateMessageStudioTemplate,
			deleteTemplate: discord.deleteMessageStudioTemplate,
		},
	},
};
