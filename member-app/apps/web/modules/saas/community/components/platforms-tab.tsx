"use client";

import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import Link from "next/link";
import { openDiscordLink } from "@/lib/onboarding-api";
import { ExternalLink } from "@/modules/ui/icons";
import type { Platform } from "../lib/types";
import { DiscordIcon } from "./discord-icon";

interface PlatformsTabProps {
	platforms: Platform[];
	onConnect: (platformId: string) => void;
	/** When false, Discord connect is hidden (requires active subscription or eligible access). */
	canConnectDiscord: boolean;
}

function getPlatformIcon(platformId: string) {
	switch (platformId) {
		case "discord":
			return <DiscordIcon className="h-10 w-10" />;
		default:
			return null;
	}
}

export function PlatformsTab({
	platforms,
	onConnect,
	canConnectDiscord,
}: PlatformsTabProps) {
	return (
		<div className="space-y-4 sm:space-y-6">
			{platforms.map((platform) => (
				<Card
					key={platform.id}
					className="overflow-hidden border-2 transition-colors hover:border-primary/30"
				>
					<CardHeader className="pb-4 sm:pb-5">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3 sm:gap-4 flex-1">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#5865F2] text-white sm:h-14 sm:w-14">
									{getPlatformIcon(platform.id)}
								</div>
								<div className="flex-1 min-w-0">
									<CardTitle className="text-lg sm:text-xl">
										{platform.name}
									</CardTitle>
									<CardDescription className="mt-1 text-xs sm:text-sm">
										{platform.description}
									</CardDescription>
								</div>
							</div>
							{!platform.connected && (
								<Badge
									status="info"
									className="shrink-0 self-start"
								>
									{platform.id === "discord" &&
									!canConnectDiscord
										? "Subscription required"
										: "Connect"}
								</Badge>
							)}
						</div>
					</CardHeader>

					<CardContent className="space-y-4 sm:space-y-5">
						{platform.connected ? (
							<>
								{platform.username && (
									<div className="rounded-lg border-2 border-green-500/30 bg-green-500/10 p-4">
										<p className="text-center text-sm font-medium text-green-500 sm:text-base">
											Connected as{" "}
											<span className="font-semibold">
												{platform.username}
											</span>
										</p>
									</div>
								)}
								<div className="space-y-3">
									<p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
										You're connected to our {platform.name}{" "}
										community! Join the conversation, ask
										questions, and connect with other
										members.
									</p>
									<Button
										className="min-h-[48px] sm:min-h-[44px] w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
										onClick={() => {
											if (
												platform.id === "discord" &&
												platform.guildId &&
												platform.channelId
											) {
												openDiscordLink(
													platform.guildId,
													platform.channelId,
												);
											} else if (platform.url) {
												window.open(
													platform.url,
													"_blank",
												);
											}
										}}
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										Open {platform.name}
									</Button>
								</div>
							</>
						) : platform.id === "discord" && !canConnectDiscord ? (
							<div className="space-y-3">
								<p className="text-sm text-muted-foreground sm:text-base">
									An active subscription or eligible access is
									required to connect Discord and join the
									server.
								</p>
								<Button
									asChild
									variant="primary"
									className="min-h-[48px] sm:min-h-[44px] w-full"
								>
									<Link href="/app/settings/billing">
										View billing & plans
									</Link>
								</Button>
							</div>
						) : (
							<Button
								className="min-h-[48px] sm:min-h-[44px] w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
								onClick={() => onConnect(platform.id)}
							>
								<ExternalLink className="mr-2 h-4 w-4" />
								Connect {platform.name}
							</Button>
						)}
					</CardContent>
				</Card>
			))}

			{/* Future Platforms */}
			<Card className="border-2 border-dashed border-border/40 bg-muted/10 lg:max-w-3xl">
				<CardContent className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
					<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/40 shadow-md sm:mb-5 sm:h-16 sm:w-16">
						<svg
							className="h-6 w-6 text-muted-foreground/70 sm:h-7 sm:w-7"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
					</div>
					<h3 className="mb-2 font-serif font-bold tracking-tight text-base text-foreground sm:text-lg">
						More Platforms Coming Soon
					</h3>
					<p className="max-w-md text-pretty text-sm text-muted-foreground">
						We're working on integrating additional platforms to
						expand your community experience.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
