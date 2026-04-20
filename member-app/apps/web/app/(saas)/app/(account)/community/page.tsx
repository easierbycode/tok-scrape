import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db } from "@repo/database";
import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { Suspense } from "react";
import { DatabaseErrorBoundary } from "@/components/DatabaseErrorBoundary";
import { CommunityHub } from "@/modules/saas/community/components/community-hub";
import type {
	Announcement,
	Platform,
} from "@/modules/saas/community/lib/types";
import { TikTokBetaSection } from "@/modules/saas/tiktok-dashboard/components/tiktok-beta-section";

export default async function CommunityPage() {
	const session = await getSession();
	const userId = session?.user?.id;
	const user = session?.user as
		| (NonNullable<typeof session>["user"] & {
				discordConnected?: boolean;
				discordUsername?: string | null;
		  })
		| undefined;

	// Fetch purchases and announcements in parallel
	const [purchases, announcementsResult] = await Promise.all([
		userId
			? db.purchase.findMany({
					where: { userId },
					select: { type: true, status: true, productId: true },
				})
			: Promise.resolve([]),
		userId
			? db.announcement.findMany({
					where: {
						publishedAt: { lte: new Date() },
						OR: [
							{ expiresAt: null },
							{ expiresAt: { gt: new Date() } },
						],
					},
					orderBy: { publishedAt: "desc" },
					include: {
						views: {
							where: { userId },
							select: { readAt: true },
						},
					},
				})
			: Promise.resolve([]),
	]);

	const hasActiveSubscription = purchases.some(
		(p) =>
			p.type === "SUBSCRIPTION" &&
			["active", "trialing", "grace_period"].includes(p.status ?? ""),
	);
	const hasManualOverride = purchases.some(
		(p) =>
			p.type === "ONE_TIME" && p.productId === MANUAL_OVERRIDE_PRODUCT_ID,
	);
	const hasLifetimePurchase = purchases.some(
		(p) =>
			p.type === "ONE_TIME" && p.productId !== MANUAL_OVERRIDE_PRODUCT_ID,
	);
	const canConnectDiscord =
		hasActiveSubscription || hasManualOverride || hasLifetimePurchase;

	const betaFeatures: string[] =
		(session?.user as { betaFeatures?: string[] } | undefined)
			?.betaFeatures ?? [];
	const hasTiktokBeta = betaFeatures.includes(
		BETA_FEATURE_IDS.TIKTOK_DASHBOARD_BETA,
	);

	const discordChannelUrl =
		process.env.NEXT_PUBLIC_DISCORD_GUILD_ID &&
		process.env.NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID
			? `https://discord.com/channels/${process.env.NEXT_PUBLIC_DISCORD_GUILD_ID}/${process.env.NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID}`
			: undefined;

	const initialPlatforms: Platform[] = [
		{
			id: "discord",
			name: "Discord",
			description:
				"Connect to access exclusive channels, member-only content, and real-time community support.",
			connected: user?.discordConnected ?? false,
			username: user?.discordUsername ?? null,
			url: discordChannelUrl,
		},
	];

	const initialAnnouncements: Announcement[] = announcementsResult.map(
		(a) => ({
			id: a.id,
			title: a.title,
			content:
				a.content.substring(0, 200) +
				(a.content.length > 200 ? "..." : ""),
			fullContent: a.content,
			date: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
			type: a.type as Announcement["type"],
			priority: a.priority as Announcement["priority"],
			author: "LifePreneur Team",
			read: a.views.length > 0,
		}),
	);

	return (
		<DatabaseErrorBoundary context="community hub">
			<PageHeader
				title="Community Hub"
				subtitle="Connect with platforms and stay updated with announcements"
			/>
			<Suspense fallback={null}>
				<CommunityHub
					canConnectDiscord={canConnectDiscord}
					initialPlatforms={initialPlatforms}
					initialAnnouncements={initialAnnouncements}
				/>
			</Suspense>

			<TikTokBetaSection hasBetaAccess={hasTiktokBeta} />
		</DatabaseErrorBoundary>
	);
}
