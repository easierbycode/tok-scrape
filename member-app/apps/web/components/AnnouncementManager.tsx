"use client";

import { logger } from "@repo/logs";
import { useNotificationSettings } from "@saas/admin/hooks/use-notification-settings";
import { useSession } from "@saas/auth/hooks/use-session";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { AlertCircle, Info, PartyPopper } from "@/modules/ui/icons";

interface Announcement {
	id: string;
	title: string;
	content: string;
	priority?: "urgent" | "important" | "normal";
	type: "onboarding" | "global";
}

const DISMISSED_STORAGE_KEY = "lp_dismissed_announcements";

function getDismissedIds(): Set<string> {
	try {
		const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
		return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
	} catch {
		return new Set();
	}
}

function persistDismissedId(id: string): void {
	try {
		const dismissed = getDismissedIds();
		dismissed.add(id);
		localStorage.setItem(
			DISMISSED_STORAGE_KEY,
			JSON.stringify([...dismissed]),
		);
	} catch {
		// localStorage unavailable — silently continue
	}
}

export function AnnouncementManager() {
	const [open, setOpen] = useState(false);
	const [announcementQueue, setAnnouncementQueue] = useState<Announcement[]>(
		[],
	);
	const [currentAnnouncement, setCurrentAnnouncement] =
		useState<Announcement | null>(null);
	const [checkedOnboarding, setCheckedOnboarding] = useState(false);
	const [checkedGlobal, setCheckedGlobal] = useState(false);
	const { shouldDisplay } = useNotificationSettings();
	const { user } = useSession();
	const pathname = usePathname();
	const dismissFromPrimaryRef = useRef(false);

	const isOnboarding = pathname?.startsWith("/onboarding");

	// Check for onboarding announcement (should show once after onboarding completion)
	useEffect(() => {
		async function checkOnboardingAnnouncement() {
			// Only check once
			if (checkedOnboarding) {
				return;
			}

			// Only check if user has completed onboarding and is not currently in the onboarding flow
			if (!user?.onboardingComplete || isOnboarding) {
				return;
			}

			try {
				const response = await fetch(
					"/api/announcements/onboarding/check",
				);
				const data = await response.json();

				const locallyDismissed = getDismissedIds().has(
					data.announcement?.id,
				);
				if (
					data.hasAnnouncement &&
					!data.dismissed &&
					!locallyDismissed
				) {
					setAnnouncementQueue((prev) => [
						...prev,
						{
							id: data.announcement.id,
							title: data.announcement.title,
							content: data.announcement.content,
							type: "onboarding" as const,
						},
					]);
				}
			} catch (error) {
				logger.error("Failed to check onboarding announcement", {
					error,
				});
			} finally {
				setCheckedOnboarding(true);
			}
		}

		checkOnboardingAnnouncement();
	}, [user?.onboardingComplete, checkedOnboarding, isOnboarding]);

	// Check for global announcement (only after onboarding announcement checked)
	useEffect(() => {
		async function checkGlobalAnnouncement() {
			// Only check once per page load
			if (checkedGlobal) {
				return;
			}

			// Wait until onboarding check is complete
			if (!checkedOnboarding) {
				return;
			}

			// Don't show during onboarding
			if (!user?.onboardingComplete || isOnboarding) {
				return;
			}

			if (!shouldDisplay("global_announcement")) {
				setCheckedGlobal(true);
				return;
			}

			try {
				const response = await fetch("/api/announcements/check-active");
				const data = await response.json();

				const locallyDismissed = getDismissedIds().has(
					data.announcement?.id,
				);
				if (
					data.hasAnnouncement &&
					!data.dismissed &&
					!locallyDismissed
				) {
					setAnnouncementQueue((prev) => [
						...prev,
						{
							id: data.announcement.id,
							title: data.announcement.title,
							content: data.announcement.content,
							priority: data.announcement.priority,
							type: "global" as const,
						},
					]);
				}
			} catch (error) {
				logger.error("Failed to check global announcement", { error });
			} finally {
				setCheckedGlobal(true);
			}
		}

		checkGlobalAnnouncement();
	}, [
		shouldDisplay,
		user?.onboardingComplete,
		checkedOnboarding,
		checkedGlobal,
		isOnboarding,
	]);

	// Process announcement queue
	useEffect(() => {
		if (!open && announcementQueue.length > 0 && !currentAnnouncement) {
			// Take the first announcement from the queue
			const [nextAnnouncement, ...rest] = announcementQueue;
			setCurrentAnnouncement(nextAnnouncement);
			setAnnouncementQueue(rest);
			setOpen(true);
		}
	}, [announcementQueue, currentAnnouncement, open]);

	const persistDismissal = useCallback(() => {
		if (!currentAnnouncement) {
			return;
		}
		const id = currentAnnouncement.id;

		// Optimistically record dismissal in localStorage immediately so
		// re-mounts or fast navigations before the DB write completes
		// don't re-show the announcement.
		persistDismissedId(id);

		setOpen(false);
		setTimeout(() => {
			setCurrentAnnouncement(null);
		}, 300);

		fetch("/api/announcements/dismiss", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ announcementId: id }),
		}).catch((error) => {
			logger.error("Failed to dismiss announcement", { error });
		});
	}, [currentAnnouncement]);

	const handlePrimaryAction = useCallback(() => {
		if (!currentAnnouncement) {
			return;
		}
		dismissFromPrimaryRef.current = true;
		capturePostHogProductEvent(
			POSTHOG_PRODUCT_EVENTS.ANNOUNCEMENT_ENGAGED,
			{
				announcement_id: currentAnnouncement.id,
				announcement_type: currentAnnouncement.type,
			},
		);
		persistDismissal();
		queueMicrotask(() => {
			dismissFromPrimaryRef.current = false;
		});
	}, [currentAnnouncement, persistDismissal]);

	const handleDismissFromChrome = useCallback(() => {
		if (!currentAnnouncement) {
			return;
		}
		if (dismissFromPrimaryRef.current) {
			return;
		}
		capturePostHogProductEvent(
			POSTHOG_PRODUCT_EVENTS.ANNOUNCEMENT_DISMISSED,
			{
				announcement_id: currentAnnouncement.id,
				announcement_type: currentAnnouncement.type,
				dismiss_method: "dialog_close",
			},
		);
		persistDismissal();
	}, [currentAnnouncement, persistDismissal]);

	if (!currentAnnouncement) {
		return null;
	}

	const getIcon = () => {
		if (currentAnnouncement.type === "onboarding") {
			return <PartyPopper className="h-6 w-6 text-primary" />;
		}

		switch (currentAnnouncement.priority) {
			case "urgent":
				return <AlertCircle className="h-6 w-6 text-red-500" />;
			case "important":
				return <AlertCircle className="h-6 w-6 text-orange-500" />;
			default:
				return <Info className="h-6 w-6 text-blue-500" />;
		}
	};

	const getButtonText = () => {
		return currentAnnouncement.type === "onboarding"
			? "Let's get started!"
			: "Got it!";
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				if (!newOpen) {
					handleDismissFromChrome();
				} else {
					setOpen(newOpen);
				}
			}}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<div className="flex items-start gap-3">
						{getIcon()}
						<div className="flex-1">
							<DialogTitle className="text-2xl">
								{currentAnnouncement.title}
							</DialogTitle>
						</div>
					</div>
				</DialogHeader>
				<DialogDescription className="text-base whitespace-pre-wrap text-foreground">
					{currentAnnouncement.content}
				</DialogDescription>
				<DialogFooter>
					<Button onClick={handlePrimaryAction}>
						{getButtonText()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
