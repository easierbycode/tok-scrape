"use client";

import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import { useSession } from "@saas/auth/hooks/use-session";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { grantDiscordAccess } from "@/lib/onboarding-api";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import { AlertCircle, Bell, ExternalLink, X } from "@/modules/ui/icons";
import type { Announcement, Platform } from "../lib/types";
import { AnnouncementDialog } from "./announcement-dialog";
import { AnnouncementsTab } from "./announcements-tab";
import { PlatformsTab } from "./platforms-tab";

const FORCE_UNREAD_KEY = "force-unread-announcements";

function getForceUnreadIds(): Set<string> {
	if (typeof window === "undefined") {
		return new Set();
	}
	try {
		const stored = localStorage.getItem(FORCE_UNREAD_KEY);
		return new Set(stored ? (JSON.parse(stored) as string[]) : []);
	} catch {
		return new Set();
	}
}

function setForceUnreadIds(ids: Set<string>) {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.setItem(FORCE_UNREAD_KEY, JSON.stringify([...ids]));
}

function clearForceUnreadIds() {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.removeItem(FORCE_UNREAD_KEY);
}

function applyForceUnread(announcements: Announcement[]): Announcement[] {
	const forceUnread = getForceUnreadIds();
	if (forceUnread.size === 0) {
		return announcements;
	}
	return announcements.map((a) =>
		forceUnread.has(a.id) ? { ...a, read: false } : a,
	);
}

interface CommunityHubProps {
	canConnectDiscord: boolean;
	initialPlatforms?: Platform[];
	initialAnnouncements?: Announcement[];
}

export function CommunityHub({
	canConnectDiscord,
	initialPlatforms = [],
	initialAnnouncements = [],
}: CommunityHubProps) {
	const { user, loaded: sessionLoaded, reloadSession } = useSession();
	const [loading, setLoading] = useState(initialPlatforms.length === 0);
	const [error, setError] = useState<string | null>(null);
	const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
	const [announcements, setAnnouncements] = useState<Announcement[]>(() =>
		applyForceUnread(initialAnnouncements),
	);
	const [selectedAnnouncement, setSelectedAnnouncement] =
		useState<Announcement | null>(null);
	const [announcementFilter, setAnnouncementFilter] = useState<
		"all" | "unread"
	>("all");
	const [announcementTypeFilter, setAnnouncementTypeFilter] =
		useState<string>("all");
	const [discordCallbackHandled, setDiscordCallbackHandled] = useState(false);
	const [bannerDismissed, setBannerDismissed] = useState(() => {
		if (typeof window === "undefined") {
			return false;
		}
		const dismissed = localStorage.getItem("community-banner-dismissed");
		if (!dismissed) {
			return false;
		}
		const dismissedDate = new Date(dismissed);
		const daysSince =
			(Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
		return daysSince < 7; // Re-show after 7 days
	});

	// Check for Discord OAuth callback and sync data
	useEffect(() => {
		async function handleDiscordCallback() {
			if (!sessionLoaded || discordCallbackHandled) {
				return;
			}

			// If user doesn't have Discord connected, try to sync
			// This will succeed if they just came back from OAuth (Account exists)
			// or gracefully return needsConnection if they haven't connected yet
			const userWithDiscord = user as
				| (typeof user & { discordConnected?: boolean })
				| null;
			if (!(userWithDiscord?.discordConnected ?? false)) {
				try {
					if (process.env.NODE_ENV === "development") {
						logger.debug("Checking for Discord account to sync");
					}

					const result = await grantDiscordAccess();

					if (result.success) {
						logger.info(
							"Discord synced successfully on Community page",
							{
								userId: user?.id,
							},
						);
						setDiscordCallbackHandled(true);

						await reloadSession();
					} else if (result.noSubscription) {
						setError(
							result.error ??
								"An active subscription is required to connect Discord.",
						);
						setDiscordCallbackHandled(true);
						await reloadSession();
					} else if (result.needsConnection) {
						// User hasn't connected yet - that's fine
						if (process.env.NODE_ENV === "development") {
							logger.debug("No Discord connection to sync");
						}
						setDiscordCallbackHandled(true);
					} else {
						if (process.env.NODE_ENV === "development") {
							logger.debug("Discord sync result", { result });
						}
						setDiscordCallbackHandled(true);
					}
				} catch (error) {
					logger.error("Failed to sync Discord after OAuth", {
						error,
					});
					setDiscordCallbackHandled(true);
				}
			} else {
				// User already has Discord connected
				setDiscordCallbackHandled(true);
			}
		}

		handleDiscordCallback();
	}, [sessionLoaded, user, discordCallbackHandled]);

	useEffect(() => {
		// Only fetch client-side when server didn't provide initial data,
		// or after a Discord callback that may have updated platform state.
		if (
			sessionLoaded &&
			(initialPlatforms.length === 0 || discordCallbackHandled)
		) {
			loadData();
		}
	}, [sessionLoaded, discordCallbackHandled]);

	async function loadData() {
		try {
			setError(null);
			const announcementsResult =
				await orpcClient.community.announcements.list();

			// Build platforms from real user data instead of mock
			const platformsData: Platform[] = [
				{
					id: "discord",
					name: "Discord",
					description:
						"Connect to access exclusive channels, member-only content, and real-time community support.",
					connected:
						(
							user as
								| (typeof user & { discordConnected?: boolean })
								| null
						)?.discordConnected ?? false,
					username:
						(
							user as
								| (typeof user & {
										discordUsername?: string | null;
								  })
								| null
						)?.discordUsername ?? null,
					// Use direct Discord channel URL (only works for existing members - more secure)
					url:
						process.env.NEXT_PUBLIC_DISCORD_GUILD_ID &&
						process.env.NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID
							? `https://discord.com/channels/${process.env.NEXT_PUBLIC_DISCORD_GUILD_ID}/${process.env.NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID}`
							: undefined,
					guildId: process.env.NEXT_PUBLIC_DISCORD_GUILD_ID,
					channelId:
						process.env.NEXT_PUBLIC_DISCORD_WELCOME_CHANNEL_ID,
				},
			];

			// Map database announcements to frontend format
			const announcementsData = announcementsResult.announcements.map(
				(a) => ({
					id: a.id,
					title: a.title,
					content:
						a.content.substring(0, 200) +
						(a.content.length > 200 ? "..." : ""), // Preview
					fullContent: a.content,
					date:
						a.publishedAt?.toISOString() ||
						a.createdAt.toISOString(),
					type: a.type as
						| "welcome"
						| "event"
						| "update"
						| "feature"
						| "maintenance"
						| "community",
					priority: a.priority as "urgent" | "important" | "normal",
					author: "LifePreneur Team", // Database doesn't store author yet
					read: a.read,
				}),
			);

			setPlatforms(platformsData);
			setAnnouncements(applyForceUnread(announcementsData));
		} catch (err) {
			logger.error("Failed to load community data", { error: err });
			setError("Unable to load community data. Please refresh the page.");
		} finally {
			setLoading(false);
		}
	}

	const handleConnect = async (platformId: string) => {
		if (platformId === "discord" && !canConnectDiscord) {
			return;
		}
		if (platformId === "discord") {
			try {
				if (process.env.NODE_ENV === "development") {
					logger.debug("Initiating Discord OAuth");
				}
				capturePostHogProductEvent(
					POSTHOG_PRODUCT_EVENTS.DISCORD_CONNECT_STARTED,
					{ source: "community_hub" },
				);
				// Initiate Discord OAuth flow
				// Note: linkSocial will redirect the user to Discord, so code after this won't execute
				await authClient.linkSocial({
					provider: "discord",
					callbackURL: window.location.href,
				});
			} catch (error) {
				logger.error("Failed to connect Discord", { error });
				setError("Failed to connect Discord. Please try again.");
			}
		}
	};

	const toggleReadStatus = async (id: string) => {
		const announcement = announcements.find((a) => a.id === id);
		if (!announcement) {
			return;
		}

		// Persist the user's "force unread" preference in localStorage so it
		// survives navigation (the server view record is intentionally kept intact).
		const forceUnread = getForceUnreadIds();
		if (announcement.read) {
			forceUnread.add(id);
		} else {
			forceUnread.delete(id);
		}
		setForceUnreadIds(forceUnread);

		// Optimistic update
		setAnnouncements(
			announcements.map((a) =>
				a.id === id ? { ...a, read: !a.read } : a,
			),
		);

		try {
			if (!announcement.read) {
				await orpcClient.community.announcements.markRead({
					announcementId: id,
				});
			}
		} catch (err) {
			logger.error("Failed to persist announcement read status", { err });
			// Revert both the optimistic UI update and the localStorage change
			if (announcement.read) {
				forceUnread.delete(id);
			} else {
				forceUnread.add(id);
			}
			setForceUnreadIds(forceUnread);
			setAnnouncements(
				announcements.map((a) =>
					a.id === id ? { ...a, read: announcement.read } : a,
				),
			);
		}
	};

	const markAllAsRead = async () => {
		// Clear all force-unread overrides so "mark all read" is a clean slate
		clearForceUnreadIds();

		// Optimistic update
		setAnnouncements(announcements.map((a) => ({ ...a, read: true })));

		try {
			await orpcClient.community.announcements.markAllRead();
		} catch (err) {
			logger.error("Failed to mark all announcements as read", { err });
			// Revert optimistic update on failure
			loadData();
		}
	};

	const handleAnnouncementClick = (announcement: Announcement) => {
		setSelectedAnnouncement(announcement);
		if (!announcement.read) {
			toggleReadStatus(announcement.id);
		}
	};

	const dismissBanner = () => {
		capturePostHogProductEvent(
			POSTHOG_PRODUCT_EVENTS.ANNOUNCEMENT_DISMISSED,
			{
				surface: "community_discord_connect_banner",
			},
		);
		setBannerDismissed(true);
		if (typeof window !== "undefined") {
			localStorage.setItem(
				"community-banner-dismissed",
				new Date().toISOString(),
			);
		}
	};

	const unreadCount = announcements.filter((a) => !a.read).length;
	const disconnectedPlatforms = platforms.filter((p) => !p.connected);
	const discordConnected =
		platforms.find((p) => p.id === "discord")?.connected ?? false;

	// Show loading while session is loading OR while data is loading
	if (loading || !sessionLoaded) {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="space-y-6">
					{/* Tabs skeleton */}
					<div className="flex gap-2 border-b">
						<Skeleton className="h-10 w-32" />
						<Skeleton className="h-10 w-32" />
					</div>
					{/* Platform cards skeleton */}
					<div className="grid gap-4">
						{Array.from({ length: 1 }, (_, i) => (
							<Card key={`platform-${i}`} className="p-6">
								<div className="space-y-4">
									<div className="flex items-center gap-3">
										<Skeleton className="h-12 w-12 rounded-lg" />
										<div className="flex-1 space-y-2">
											<Skeleton className="h-5 w-24" />
											<Skeleton className="h-4 w-32" />
										</div>
									</div>
									<Skeleton className="h-10 w-full" />
								</div>
							</Card>
						))}
					</div>
					{/* Announcements list skeleton */}
					<div className="space-y-4">
						{Array.from({ length: 5 }, (_, i) => (
							<Card key={`announcement-${i}`} className="p-6">
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<Skeleton className="h-10 w-10 rounded-full" />
										<div className="flex-1 space-y-2">
											<Skeleton className="h-5 w-3/4" />
											<Skeleton className="h-4 w-full" />
											<Skeleton className="h-4 w-1/2" />
										</div>
									</div>
								</div>
							</Card>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				<Alert variant="error">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button onClick={loadData} className="mt-4" variant="outline">
					Retry
				</Button>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			{/* Discord banner — subscription gate vs connect reminder */}
			{disconnectedPlatforms.length > 0 &&
				!bannerDismissed &&
				!discordConnected &&
				!canConnectDiscord && (
					<Card className="mb-6 overflow-hidden border-l-4 border-l-amber-500 bg-amber-500/5 relative">
						<CardContent className="p-5 sm:p-6">
							<div className="flex flex-col gap-4">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-3 sm:gap-4 flex-1">
										<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 sm:h-14 sm:w-14">
											<AlertCircle className="h-6 w-6 text-amber-600 sm:h-7 sm:w-7" />
										</div>
										<div className="flex-1">
											<h3 className="font-serif font-bold tracking-tight text-lg sm:text-xl flex items-center gap-2 flex-wrap">
												Discord community
												<Badge
													status="warning"
													className="text-xs"
												>
													Subscription required
												</Badge>
											</h3>
											<p className="text-sm text-muted-foreground sm:text-base">
												Subscribe or restore access to
												connect Discord and join the
												server.
											</p>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0 hover:bg-amber-500/10 shrink-0"
										onClick={dismissBanner}
										aria-label="Dismiss banner"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
								<Button
									size="lg"
									asChild
									className="w-full shrink-0 px-6 text-base font-semibold shadow-raised sm:w-auto min-h-[48px] sm:min-h-[44px]"
								>
									<Link href="/app/settings/billing">
										View billing & plans
									</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
				)}
			{disconnectedPlatforms.length > 0 &&
				!bannerDismissed &&
				!discordConnected &&
				canConnectDiscord && (
					<Card className="mb-6 overflow-hidden border-l-4 border-l-amber-500 bg-amber-500/5 relative">
						<CardContent className="p-5 sm:p-6">
							<div className="flex flex-col gap-4">
								{/* Header with dismiss button */}
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-3 sm:gap-4 flex-1">
										<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 sm:h-14 sm:w-14">
											<AlertCircle className="h-6 w-6 text-amber-600 sm:h-7 sm:w-7" />
										</div>
										<div className="flex-1">
											<h3 className="font-serif font-bold tracking-tight text-lg sm:text-xl flex items-center gap-2 flex-wrap">
												Discord Required
												<Badge
													status="warning"
													className="text-xs"
												>
													Important
												</Badge>
											</h3>
											<p className="text-sm text-muted-foreground sm:text-base">
												Connect to Discord - our primary
												support and community channel
											</p>
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-8 w-8 p-0 hover:bg-amber-500/10 shrink-0"
										onClick={dismissBanner}
										aria-label="Dismiss banner"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
								{/* Connect button */}
								<Button
									size="lg"
									className="w-full shrink-0 bg-[#5865F2] hover:bg-[#4752C4] px-6 text-base font-semibold shadow-raised sm:w-auto min-h-[48px] sm:min-h-[44px]"
									onClick={() =>
										handleConnect(
											disconnectedPlatforms[0].id,
										)
									}
								>
									<ExternalLink className="mr-2 h-4 w-4" />
									Connect Now
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

			<Tabs defaultValue="platforms" className="w-full">
				<TabsList className="grid h-12 w-full max-w-md grid-cols-2 gap-2 sm:h-11">
					<TabsTrigger
						value="platforms"
						className="text-sm sm:text-base"
					>
						Platforms
					</TabsTrigger>
					<TabsTrigger
						value="announcements"
						className="relative text-sm sm:text-base"
					>
						<Bell className="mr-2 h-4 w-4" />
						Announcements
						{unreadCount > 0 && (
							<Badge
								status="info"
								className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full"
							>
								{unreadCount}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				<TabsContent value="platforms" className="mt-6">
					<PlatformsTab
						platforms={platforms}
						onConnect={handleConnect}
						canConnectDiscord={canConnectDiscord}
					/>
				</TabsContent>

				<TabsContent value="announcements" className="mt-6">
					<AnnouncementsTab
						announcements={announcements}
						filter={announcementFilter}
						typeFilter={announcementTypeFilter}
						onFilterChange={setAnnouncementFilter}
						onTypeFilterChange={setAnnouncementTypeFilter}
						onMarkAsRead={toggleReadStatus}
						onMarkAllAsRead={markAllAsRead}
						onAnnouncementClick={handleAnnouncementClick}
					/>
				</TabsContent>
			</Tabs>

			<AnnouncementDialog
				announcement={selectedAnnouncement}
				isOpen={!!selectedAnnouncement}
				onClose={() => setSelectedAnnouncement(null)}
				onToggleRead={toggleReadStatus}
			/>
		</div>
	);
}
