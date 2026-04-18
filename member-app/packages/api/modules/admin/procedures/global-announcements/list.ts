import { db } from "@repo/database";
import { adminProcedure } from "../../../../orpc/procedures";

export const list = adminProcedure
	.route({
		method: "GET",
		path: "/admin/announcements/global",
		tags: ["Administration"],
		summary: "List global announcements",
	})
	.handler(async () => {
		const announcements = await db.globalAnnouncement.findMany({
			where: {
				type: {
					in: ["site-wide", "onboarding"],
				},
			},
		});

		const siteWide = announcements.find((a) => a.type === "site-wide");
		const onboarding = announcements.find((a) => a.type === "onboarding");

		return {
			siteWide: siteWide
				? {
						id: siteWide.id,
						enabled: siteWide.enabled,
						title: siteWide.title,
						content: siteWide.content,
						priority: siteWide.priority,
					}
				: null,
			onboarding: onboarding
				? {
						id: onboarding.id,
						enabled: onboarding.enabled,
						title: onboarding.title,
						content: onboarding.content,
					}
				: null,
		};
	});
