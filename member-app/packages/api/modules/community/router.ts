import { checkActive } from "./procedures/announcements/check-active";
import { dismiss } from "./procedures/announcements/dismiss";
import { listAnnouncements } from "./procedures/announcements/list";
import {
	markAllAnnouncementsRead,
	markAnnouncementRead,
} from "./procedures/announcements/mark-read";

export const communityRouter = {
	announcements: {
		list: listAnnouncements,
		checkActive,
		dismiss,
		markRead: markAnnouncementRead,
		markAllRead: markAllAnnouncementsRead,
	},
};
