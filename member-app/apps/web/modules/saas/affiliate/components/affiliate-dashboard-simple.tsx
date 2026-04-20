"use client";

import { Alert, AlertDescription } from "@ui/components/alert";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import { Input } from "@ui/components/input";
import { Separator } from "@ui/components/separator";
import { useCardTilt } from "@ui/hooks/use-card-tilt";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertTriangle,
	CheckCircle2,
	CircleDollarSign,
	Copy,
	ExternalLink,
	Loader2,
	MousePointer2,
	RefreshCw,
	Users,
} from "@/modules/ui/icons";

function StatCard({
	children,
	delay = 0,
}: {
	children: React.ReactNode;
	delay?: number;
}) {
	const { ref: inViewRef, isInView } = useInView();
	const { ref: tiltRef, style: tiltStyle } = useCardTilt(6);

	return (
		<div
			ref={inViewRef}
			className={cn(
				"transition-[opacity,transform] duration-500",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-4",
			)}
			style={{ transitionDelay: `${delay}ms` }}
		>
			<Card ref={tiltRef} style={tiltStyle}>
				{children}
			</Card>
		</div>
	);
}

import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { orpcClient } from "@/modules/shared/lib/orpc-client";

const ONE_HOUR_MS = 60 * 60 * 1000;

interface AffiliateStats {
	visitors: number;
	conversions: number;
	commissionsEarned: number;
	commissionsPending: number;
	commissionsPaid: number;
	lastSyncAt: string | null;
}

interface AffiliateDashboardSimpleProps extends AffiliateStats {
	primaryLinkUrl: string | null;
}

function formatCurrency(dollars: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(dollars);
}

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function extractToken(url: string | null): string | null {
	if (!url) {
		return null;
	}
	try {
		return new URL(url).searchParams.get("via");
	} catch {
		return null;
	}
}

function formatTimeAgo(isoString: string | null): string {
	if (!isoString) {
		return "Never synced";
	}
	const diffMs = Date.now() - new Date(isoString).getTime();
	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 1) {
		return "Just now";
	}
	if (minutes < 60) {
		return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function AffiliateDashboardSimple({
	primaryLinkUrl: initialLinkUrl,
	visitors: initialVisitors,
	conversions: initialConversions,
	commissionsEarned: initialCommissionsEarned,
	commissionsPending: initialCommissionsPending,
	commissionsPaid: initialCommissionsPaid,
	lastSyncAt: initialLastSyncAt,
}: AffiliateDashboardSimpleProps) {
	const [linkUrl, setLinkUrl] = useState(initialLinkUrl);
	const affiliateToken = extractToken(linkUrl);
	const [stats, setStats] = useState<AffiliateStats>({
		visitors: initialVisitors,
		conversions: initialConversions,
		commissionsEarned: initialCommissionsEarned,
		commissionsPending: initialCommissionsPending,
		commissionsPaid: initialCommissionsPaid,
		lastSyncAt: initialLastSyncAt,
	});
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [refreshState, setRefreshState] = useState<
		"idle" | "loading" | "failed"
	>("idle");
	const [refreshError, setRefreshError] = useState<string | null>(null);
	const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

	// Silently refresh stats on mount if data is stale (> 1 hour old or never synced)
	useEffect(() => {
		const isStale =
			!stats.lastSyncAt ||
			Date.now() - new Date(stats.lastSyncAt).getTime() > ONE_HOUR_MS;

		if (!isStale) {
			return;
		}

		setIsRefreshing(true);
		orpcClient.users.affiliate
			.refreshStats()
			.then((result) => {
				setStats({
					visitors: result.visitors,
					conversions: result.conversions,
					commissionsEarned: result.commissionsEarned / 100,
					commissionsPending: result.commissionsPending / 100,
					commissionsPaid: result.commissionsPaid / 100,
					lastSyncAt: result.lastSyncAt,
				});
				if (
					result.primaryLinkUrl &&
					result.primaryLinkUrl !== linkUrl
				) {
					setLinkUrl(result.primaryLinkUrl);
				}
			})
			.catch(() => {
				// Silent failure — cached data remains displayed
			})
			.finally(() => {
				setIsRefreshing(false);
			});
	}, []);

	const handleCopy = () => {
		if (!linkUrl) {
			return;
		}
		navigator.clipboard.writeText(linkUrl);
		toast.success("Link copied to clipboard!");
	};

	const handleRefreshLink = async () => {
		setRefreshState("loading");
		setRefreshError(null);
		try {
			const result = await orpcClient.users.affiliate.refreshLink();
			setLinkUrl(result.primaryLinkUrl);
			setRefreshState("idle");
			toast.success("Affiliate link retrieved successfully!");
		} catch (error: any) {
			setRefreshState("failed");
			setRefreshError(
				error.message || "Failed to retrieve link from Rewardful.",
			);
		}
	};

	const handleOpenDashboard = async () => {
		setIsLoadingDashboard(true);
		try {
			const result = await orpcClient.users.affiliate.getDashboardLink();
			capturePostHogProductEvent(
				POSTHOG_PRODUCT_EVENTS.AFFILIATE_CTA_CLICKED,
				{
					destination: "rewardful_dashboard",
				},
			);
			window.open(result.url, "_blank");
		} catch (error: any) {
			toast.error(error.message || "Failed to open dashboard");
		} finally {
			setIsLoadingDashboard(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* Affiliate link card */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-green-500" />
						<Badge status="success">Enrolled as Affiliate</Badge>
					</div>
					<CardTitle className="mt-2">Your Affiliate Link</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{linkUrl ? (
						<>
							<div className="flex gap-2">
								<Input
									value={linkUrl}
									readOnly
									className="min-w-0 flex-1 font-mono text-sm"
								/>
								<Button onClick={handleCopy} size="icon">
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<p className="text-sm text-muted-foreground">
								Share this link to earn commissions on
								referrals.
							</p>

							{affiliateToken && (
								<div className="rounded-md bg-muted/50 px-4 py-3 space-y-1.5">
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground">
											Your referral token
										</span>
										<code className="text-xs font-mono bg-muted rounded px-1.5 py-0.5 font-semibold">
											?via={affiliateToken}
										</code>
									</div>
									<p className="text-xs text-muted-foreground">
										You can also link to any page on our
										site by adding{" "}
										<code className="font-mono">
											?via={affiliateToken}
										</code>{" "}
										to the end of the URL.
									</p>
								</div>
							)}
						</>
					) : (
						<div className="space-y-3">
							<Alert variant="error">
								<AlertTriangle className="h-4 w-4" />
								<AlertDescription>
									{refreshState === "failed" && refreshError
										? refreshError
										: "Your referral link isn't available yet. Click below to pull it from Rewardful."}
								</AlertDescription>
							</Alert>
							{refreshState !== "failed" && (
								<Button
									onClick={handleRefreshLink}
									disabled={refreshState === "loading"}
									variant="outline"
									className="w-full"
								>
									{refreshState === "loading" ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Retrieving from Rewardful...
										</>
									) : (
										<>
											<RefreshCw className="h-4 w-4 mr-2" />
											Retrieve My Affiliate Link
										</>
									)}
								</Button>
							)}
							{refreshState === "failed" && (
								<p className="text-xs text-muted-foreground">
									Please use the Rewardful dashboard below to
									find your link, or contact support if the
									issue persists.
								</p>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Stats cards */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Clicks */}
				<StatCard delay={0}>
					<CardContent className="pt-6">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Clicks
								</p>
								<p className="text-3xl font-bold tracking-tight">
									{formatNumber(stats.visitors)}
								</p>
								<p className="text-xs text-muted-foreground">
									Primary link
								</p>
							</div>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
								<MousePointer2 className="h-5 w-5 text-blue-500" />
							</div>
						</div>
					</CardContent>
				</StatCard>

				{/* Customers */}
				<StatCard delay={100}>
					<CardContent className="pt-6">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Customers
								</p>
								<p className="text-3xl font-bold tracking-tight">
									{formatNumber(stats.conversions)}
								</p>
								<p className="text-xs text-muted-foreground">
									Referred conversions
								</p>
							</div>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
								<Users className="h-5 w-5 text-primary" />
							</div>
						</div>
					</CardContent>
				</StatCard>

				{/* Commissions */}
				<StatCard delay={200}>
					<CardContent className="pt-6">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Commissions
								</p>
								<p className="text-2xl font-bold tracking-tight text-success">
									{formatCurrency(stats.commissionsEarned)}
								</p>
								<p className="text-xs text-muted-foreground">
									Earned
								</p>
							</div>
							<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
								<CircleDollarSign className="h-5 w-5 text-success" />
							</div>
						</div>
						<Separator className="my-4" />
						<div className="space-y-1.5 text-sm">
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">
									Paid out
								</span>
								<span className="font-medium">
									{formatCurrency(stats.commissionsPaid)}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">
									Pending
								</span>
								<span className="font-medium">
									{formatCurrency(stats.commissionsPending)}
								</span>
							</div>
						</div>
					</CardContent>
				</StatCard>
			</div>

			{/* Last synced timestamp */}
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				{isRefreshing ? (
					<>
						<Loader2 className="h-3 w-3 animate-spin" />
						<span>Syncing with Rewardful...</span>
					</>
				) : (
					<span>Stats updated {formatTimeAgo(stats.lastSyncAt)}</span>
				)}
			</div>

			{/* Rewardful dashboard CTA */}
			<Card>
				<CardHeader>
					<CardTitle>Full Analytics</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						For a full breakdown of your commissions, payout
						history, and detailed referral analytics, open your
						Rewardful dashboard.
					</p>
					<Button
						onClick={handleOpenDashboard}
						disabled={isLoadingDashboard}
						className="w-full"
						size="lg"
					>
						{isLoadingDashboard ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Opening Dashboard...
							</>
						) : (
							<>
								<ExternalLink className="h-4 w-4 mr-2" />
								Open Dashboard on Rewardful
							</>
						)}
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
