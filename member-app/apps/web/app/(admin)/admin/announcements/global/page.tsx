"use client";

import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { Switch } from "@ui/components/switch";
import { Textarea } from "@ui/components/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import { AlertCircle, Bell, Save } from "@/modules/ui/icons";

export default function GlobalAnnouncementsPage() {
	const [siteWide, setSiteWide] = useState({
		id: null as string | null,
		enabled: false,
		title: "",
		content: "",
		priority: "normal" as "normal" | "important" | "urgent",
	});

	const [onboarding, setOnboarding] = useState({
		id: null as string | null,
		enabled: false,
		title: "Welcome to LifePreneur! 🎉",
		content: "",
	});

	const [loading, setLoading] = useState(true);
	const [savingSiteWide, setSavingSiteWide] = useState(false);
	const [savingOnboarding, setSavingOnboarding] = useState(false);

	// Load existing announcements
	useEffect(() => {
		async function loadAnnouncements() {
			try {
				const data = await orpcClient.admin.globalAnnouncements.list();

				if (data.siteWide) {
					setSiteWide({
						id: data.siteWide.id,
						enabled: data.siteWide.enabled,
						title: data.siteWide.title,
						content: data.siteWide.content,
						priority:
							(data.siteWide.priority as
								| "normal"
								| "important"
								| "urgent") || "normal",
					});
				}
				if (data.onboarding) {
					setOnboarding({
						id: data.onboarding.id,
						enabled: data.onboarding.enabled,
						title: data.onboarding.title,
						content: data.onboarding.content,
					});
				}
			} catch (error) {
				logger.error("Failed to load announcements", { error });
				toast.error("Failed to load announcements");
			} finally {
				setLoading(false);
			}
		}

		loadAnnouncements();
	}, []);

	const saveSiteWide = async () => {
		setSavingSiteWide(true);
		try {
			const result = await orpcClient.admin.globalAnnouncements.upsert({
				type: "site-wide",
				...siteWide,
			});

			if (result.announcement) {
				// Update with full state from backend to sync toggle
				setSiteWide({
					id: result.announcement.id,
					enabled: result.announcement.enabled,
					title: result.announcement.title,
					content: result.announcement.content,
					priority: result.announcement.priority as
						| "normal"
						| "important"
						| "urgent",
				});
				toast.success("Site-wide announcement saved!");
			} else {
				toast.error("Failed to save announcement");
			}
		} catch (error) {
			logger.error("Save failed", { error, type: "site-wide" });
			toast.error("Failed to save announcement");
		} finally {
			setSavingSiteWide(false);
		}
	};

	const saveOnboarding = async () => {
		setSavingOnboarding(true);
		try {
			const result = await orpcClient.admin.globalAnnouncements.upsert({
				type: "onboarding",
				...onboarding,
			});

			if (result.announcement) {
				// Update with full state from backend to sync toggle
				setOnboarding({
					id: result.announcement.id,
					enabled: result.announcement.enabled,
					title: result.announcement.title,
					content: result.announcement.content,
				});
				toast.success("Onboarding announcement saved!");
			} else {
				toast.error("Failed to save announcement");
			}
		} catch (error) {
			logger.error("Save failed", { error, type: "onboarding" });
			toast.error("Failed to save announcement");
		} finally {
			setSavingOnboarding(false);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-10 w-64 bg-muted animate-pulse rounded" />
				<Card className="p-6">
					<div className="h-96 bg-muted animate-pulse rounded" />
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Global Announcements
				</h1>
				<p className="text-muted-foreground mt-2">
					Manage site-wide and onboarding welcome announcements
				</p>
			</div>

			{/* Info Alert */}
			<Card className="p-4 bg-blue-500/10 border-blue-500/20">
				<div className="flex gap-3">
					<AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
					<div className="text-sm">
						<p className="font-medium text-blue-500">
							Notification Settings
						</p>
						<p className="text-muted-foreground mt-1">
							Admins can disable global announcements in
							Notifications → Settings. Disabled admins won't see
							announcement modals.
						</p>
					</div>
				</div>
			</Card>

			{/* Site-Wide Announcement Card */}
			<Card className="p-6">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl font-semibold flex items-center gap-2">
								<Bell className="h-5 w-5" />
								Site-Wide Announcement
							</h2>
							<p className="text-sm text-muted-foreground mt-1">
								Toggle to enable/disable, then click Save
								Changes. Shows as a modal to all users when
								enabled.
							</p>
						</div>
						<Switch
							id="site-wide-enabled"
							checked={siteWide.enabled}
							onCheckedChange={(checked) =>
								setSiteWide({ ...siteWide, enabled: checked })
							}
						/>
					</div>

					<div className="space-y-4">
						<div>
							<Label htmlFor="site-wide-title">Title</Label>
							<Input
								id="site-wide-title"
								placeholder="Important Update"
								value={siteWide.title}
								onChange={(e) =>
									setSiteWide({
										...siteWide,
										title: e.target.value,
									})
								}
								className="mt-1.5"
							/>
						</div>

						<div>
							<Label htmlFor="site-wide-content">Content</Label>
							<Textarea
								id="site-wide-content"
								placeholder="Your announcement message..."
								value={siteWide.content}
								onChange={(e) =>
									setSiteWide({
										...siteWide,
										content: e.target.value,
									})
								}
								rows={6}
								className="mt-1.5"
							/>
						</div>

						<div>
							<Label>Priority</Label>
							<div className="flex gap-2 mt-1.5">
								{(
									["normal", "important", "urgent"] as const
								).map((priority) => (
									<Button
										key={priority}
										variant={
											siteWide.priority === priority
												? "primary"
												: "outline"
										}
										size="sm"
										onClick={() =>
											setSiteWide({
												...siteWide,
												priority,
											})
										}
									>
										{priority.charAt(0).toUpperCase() +
											priority.slice(1)}
									</Button>
								))}
							</div>
						</div>
					</div>

					<div className="flex gap-2 pt-2">
						<Button
							onClick={saveSiteWide}
							disabled={savingSiteWide}
						>
							<Save className="h-4 w-4 mr-2" />
							{savingSiteWide ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</Card>

			{/* Onboarding Welcome Card */}
			<Card className="p-6">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xl font-semibold flex items-center gap-2">
								<Bell className="h-5 w-5" />
								Onboarding Welcome Message
							</h2>
							<p className="text-sm text-muted-foreground mt-1">
								Toggle to enable/disable, then click Save
								Changes. Shows once after new users complete
								onboarding.
							</p>
						</div>
						<Switch
							id="onboarding-enabled"
							checked={onboarding.enabled}
							onCheckedChange={(checked) =>
								setOnboarding({
									...onboarding,
									enabled: checked,
								})
							}
						/>
					</div>

					<div className="space-y-4">
						<div>
							<Label htmlFor="onboarding-title">Title</Label>
							<Input
								id="onboarding-title"
								placeholder="Welcome to LifePreneur! 🎉"
								value={onboarding.title}
								onChange={(e) =>
									setOnboarding({
										...onboarding,
										title: e.target.value,
									})
								}
								className="mt-1.5"
							/>
						</div>

						<div>
							<Label htmlFor="onboarding-content">Content</Label>
							<Textarea
								id="onboarding-content"
								placeholder="Welcome message with getting started tips..."
								value={onboarding.content}
								onChange={(e) =>
									setOnboarding({
										...onboarding,
										content: e.target.value,
									})
								}
								rows={8}
								className="mt-1.5"
							/>
						</div>
					</div>

					<div className="flex gap-2 pt-2">
						<Button
							onClick={saveOnboarding}
							disabled={savingOnboarding}
						>
							<Save className="h-4 w-4 mr-2" />
							{savingOnboarding ? "Saving..." : "Save Changes"}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}
