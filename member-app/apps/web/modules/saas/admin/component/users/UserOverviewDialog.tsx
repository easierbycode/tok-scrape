"use client";

import {
	DiscordBadge,
	RoleBadge,
	SubscriptionStatusBadge,
} from "@saas/admin/component/StatusBadges";
import { formatAppRoleLabel } from "@saas/admin/lib/app-role-label";
import { formatDate } from "@saas/admin/lib/subscription-utils";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@ui/components/accordion";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Separator } from "@ui/components/separator";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Clock,
	Copy,
	CreditCard,
	ExternalLink,
	Link2,
	Mail,
	MessageCircle,
	Shield,
	Tag,
	TrendingUp,
} from "@/modules/ui/icons";

interface PurchaseRecord {
	id: string;
	type: string;
	status: string;
	planLabel: string;
	customerId: string;
	subscriptionId?: string;
	productId: string;
	cachedAmount?: number;
	cachedInterval?: string;
	cachedCouponName?: string;
	cachedDiscountPercent?: number;
	referralCode?: string;
	currentPeriodEnd?: string;
	cancelAtPeriodEnd?: boolean;
	cancelledAt?: string;
	trialEnd?: string;
	createdAt: string;
	updatedAt: string;
}

interface AffiliateData {
	id: string;
	rewardfulId: string;
	slug: string;
	status: string;
	primaryLinkUrl?: string;
	visitors: number;
	leads: number;
	conversions: number;
	commissionsEarned: number;
	commissionsPending: number;
	commissionsPaid: number;
	lastSyncAt?: string;
	syncStatus: string;
	joinedAt: string;
}

interface User {
	id: string;
	name: string;
	email: string;
	stripeEmail?: string;
	notificationEmail?: string;
	subscriptionStatus:
		| "active"
		| "cancelled"
		| "grace_period"
		| "scheduled_cancel"
		| "none"
		| "manual"
		| "trial"
		| "lifetime";
	planLabel?: string;
	discordConnected: boolean;
	discordId?: string;
	discordRoleKey?: string | null;
	role: string | null;
	avatar?: string;
	joinedAt: string;
	emailVerified?: boolean;
	lastLogin?: string;
	loginCount?: number;
	referredBySlug?: string;
	betaFeatures?: string[];
	isAffiliate?: boolean;
	affiliateData?: AffiliateData;
	purchaseHistory?: PurchaseRecord[];
	recentSessions?: Array<{
		createdAt: string;
		ipAddress?: string;
		userAgent?: string;
	}>;
	connectedAccounts?: Array<{ providerId: string; createdAt: string }>;
	subscriptionDetails?: {
		trialEnd?: string;
		currentPeriodEnd?: string;
		cancelAtPeriodEnd?: boolean;
	} | null;
}

interface UserOverviewDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function friendlyDiscordRoleName(key: string): string {
	if (key === "DISCORD_STARTER_ROLE_ID") {
		return "Starter";
	}
	if (key === "DISCORD_ACTIVE_ROLE_ID") {
		return "Creator";
	}
	return key;
}

function getPurchaseStatusColor(status: string) {
	if (status === "active") {
		return "bg-green-500/10 text-green-600 dark:text-green-400";
	}
	if (status === "cancelled") {
		return "bg-red-500/10 text-red-600 dark:text-red-400";
	}
	if (status === "grace_period") {
		return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
	}
	return "bg-muted/60 text-muted-foreground";
}

export function UserOverviewDialog({
	user,
	open,
	onOpenChange,
}: UserOverviewDialogProps) {
	const [betaFeaturesExpanded, setBetaFeaturesExpanded] = useState(false);

	if (!user) {
		return null;
	}

	const parseUserAgent = (userAgent?: string): string => {
		if (!userAgent) {
			return "Unknown";
		}
		if (userAgent.includes("Chrome")) {
			return "Chrome";
		}
		if (userAgent.includes("Firefox")) {
			return "Firefox";
		}
		if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
			return "Safari";
		}
		if (userAgent.includes("Edge")) {
			return "Edge";
		}
		if (userAgent.includes("Opera")) {
			return "Opera";
		}
		return "Unknown Browser";
	};

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	};

	const formatCents = (cents: number) =>
		`$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	// Account health issues
	const healthIssues: Array<{
		type: string;
		message: string;
		severity: "warning" | "error";
	}> = [];

	if (!user.emailVerified) {
		healthIssues.push({
			type: "email",
			message: "Email not verified",
			severity: "warning",
		});
	}

	if (user.subscriptionDetails?.trialEnd) {
		const trialEndDate = new Date(user.subscriptionDetails.trialEnd);
		const daysUntilTrialEnd = Math.ceil(
			(trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);
		if (daysUntilTrialEnd > 0 && daysUntilTrialEnd <= 7) {
			healthIssues.push({
				type: "trial",
				message: `Trial ending in ${daysUntilTrialEnd} day${daysUntilTrialEnd !== 1 ? "s" : ""}`,
				severity: "warning",
			});
		}
	}

	if (
		user.subscriptionStatus === "scheduled_cancel" &&
		user.subscriptionDetails?.currentPeriodEnd
	) {
		const accessEndDate = new Date(
			user.subscriptionDetails.currentPeriodEnd,
		);
		const daysLeft = Math.ceil(
			(accessEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);
		if (daysLeft > 0) {
			healthIssues.push({
				type: "scheduled_cancel",
				message: `Scheduled cancel: paid access ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
				severity: "warning",
			});
		}
	}

	if (
		user.subscriptionStatus === "grace_period" &&
		user.subscriptionDetails?.currentPeriodEnd
	) {
		const graceEndDate = new Date(
			user.subscriptionDetails.currentPeriodEnd,
		);
		const daysUntilGraceEnd = Math.ceil(
			(graceEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);
		if (daysUntilGraceEnd > 0) {
			healthIssues.push({
				type: "grace",
				message: `Payment grace period: ${daysUntilGraceEnd} day${daysUntilGraceEnd !== 1 ? "s" : ""} remaining`,
				severity: "error",
			});
		}
	}

	const betaFeaturesToShow = betaFeaturesExpanded
		? user.betaFeatures || []
		: (user.betaFeatures || []).slice(0, 6);
	const hasMoreBetaFeatures = (user.betaFeatures?.length || 0) > 6;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="font-serif font-semibold">
						User Overview
					</DialogTitle>
					<DialogDescription>
						Complete information and activity for this user
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Profile Section */}
					<div className="flex items-start gap-4">
						<UserAvatar
							className="h-16 w-16 text-xl"
							name={user.name ?? user.email}
							avatarUrl={user.avatar}
						/>
						<div className="flex-1 space-y-2">
							<div className="flex items-center gap-3">
								<h3 className="text-xl font-semibold">
									{user.name}
								</h3>
								<RoleBadge role={user.role} />
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Mail className="h-4 w-4" />
								{user.email}
							</div>
							{user.stripeEmail &&
								user.stripeEmail !== user.email && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<CreditCard className="h-4 w-4" />
										<span className="text-xs">
											Stripe email: {user.stripeEmail}
										</span>
										<Button
											variant="ghost"
											size="sm"
											className="h-5 w-5 p-0"
											onClick={() =>
												copyToClipboard(
													user.stripeEmail!,
													"Stripe email",
												)
											}
										>
											<Copy className="h-3 w-3" />
										</Button>
									</div>
								)}
						</div>
					</div>

					{/* Account Health Alerts */}
					{healthIssues.length > 0 && (
						<div className="space-y-2">
							{healthIssues.map((issue) => (
								<Alert
									key={issue.type}
									variant={
										issue.severity === "error"
											? "error"
											: "default"
									}
									className={
										issue.severity === "warning"
											? "bg-yellow-500/10 border-yellow-500/50"
											: ""
									}
								>
									<AlertTriangle className="h-4 w-4" />
									<AlertDescription>
										{issue.message}
									</AlertDescription>
								</Alert>
							))}
						</div>
					)}

					<Separator />

					{/* Key Information */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Key Information
						</h4>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
								<CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Access Status
									</p>
									<div className="flex items-center gap-2 flex-wrap">
										<SubscriptionStatusBadge
											status={
												user.subscriptionStatus as any
											}
										/>
										{user.planLabel && (
											<Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
												<Tag className="h-3 w-3 mr-1" />
												{user.planLabel}
											</Badge>
										)}
									</div>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
								<MessageCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
								<div className="space-y-1 flex-1">
									<p className="text-sm font-medium">
										Discord Connection
									</p>
									{user.discordConnected ? (
										<DiscordBadge isConnected={true} />
									) : (
										<Badge className="border-muted-foreground/30">
											Not Connected
										</Badge>
									)}
									{user.discordId && (
										<div className="flex items-center gap-2 mt-2">
											<span className="text-xs text-muted-foreground font-mono">
												ID: {user.discordId}
											</span>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												onClick={() =>
													copyToClipboard(
														user.discordId!,
														"Discord ID",
													)
												}
											>
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									)}
									{user.discordRoleKey ? (
										<p className="text-xs text-muted-foreground mt-1">
											Role:{" "}
											{friendlyDiscordRoleName(
												user.discordRoleKey,
											)}
										</p>
									) : null}
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
								<Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Member Since
									</p>
									<p className="text-sm text-muted-foreground tabular-nums">
										{formatDate(user.joinedAt)}
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
								<Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Account Role
									</p>
									<p className="text-sm text-muted-foreground">
										{formatAppRoleLabel(user.role)}
									</p>
								</div>
							</div>
						</div>
					</div>

					<Separator />

					{/* Activity Stats */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Activity Statistics
						</h4>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
							<div className="p-4 rounded-lg border bg-card text-center">
								<div className="text-2xl font-bold text-primary">
									{user.loginCount ?? 0}
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Logins
								</div>
							</div>
							<div className="p-4 rounded-lg border bg-card text-center">
								<div className="text-2xl font-bold text-muted-foreground">
									-
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Content Views
								</div>
							</div>
							<div className="p-4 rounded-lg border bg-card text-center">
								<div className="text-2xl font-bold text-muted-foreground">
									-
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Comments
								</div>
							</div>
							<div className="p-4 rounded-lg border bg-card text-center">
								<div className="text-2xl font-bold text-muted-foreground">
									-
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Shares
								</div>
							</div>
						</div>
						<p className="text-xs text-muted-foreground italic">
							Note: Content Views, Comments, and Shares tracking
							coming soon.
						</p>
					</div>

					<Separator />

					{/* Purchase History */}
					{user.purchaseHistory &&
						user.purchaseHistory.length > 0 && (
							<>
								<Accordion
									type="single"
									collapsible
									className="w-full"
								>
									<AccordionItem value="purchases">
										<AccordionTrigger>
											<div className="flex items-center gap-2">
												<CreditCard className="h-4 w-4 text-muted-foreground" />
												<span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
													Purchase History (
													{
														user.purchaseHistory
															.length
													}
													)
												</span>
											</div>
										</AccordionTrigger>
										<AccordionContent>
											<div className="space-y-3 pt-2">
												{user.purchaseHistory.map(
													(purchase) => (
														<div
															key={purchase.id}
															className="p-3 rounded-lg border bg-card space-y-2"
														>
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-2">
																	<Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
																		<Tag className="h-3 w-3 mr-1" />
																		{
																			purchase.planLabel
																		}
																	</Badge>
																	<Badge
																		className={`text-xs ${getPurchaseStatusColor(purchase.status)}`}
																	>
																		{
																			purchase.status
																		}
																	</Badge>
																</div>
																{purchase.cachedAmount !==
																	undefined && (
																	<span className="text-sm font-medium tabular-nums">
																		{formatCents(
																			purchase.cachedAmount,
																		)}
																		{purchase.cachedInterval && (
																			<span className="text-xs text-muted-foreground">
																				/
																				{
																					purchase.cachedInterval
																				}
																			</span>
																		)}
																	</span>
																)}
															</div>
															<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
																<div>
																	<span className="font-medium">
																		Started:{" "}
																	</span>
																	{formatDate(
																		purchase.createdAt,
																	)}
																</div>
																{purchase.currentPeriodEnd && (
																	<div>
																		<span className="font-medium">
																			{purchase.cancelAtPeriodEnd
																				? "Ends: "
																				: "Renews: "}
																		</span>
																		{formatDate(
																			purchase.currentPeriodEnd,
																		)}
																	</div>
																)}
																{purchase.cancelledAt && (
																	<div>
																		<span className="font-medium">
																			Cancelled:{" "}
																		</span>
																		{formatDate(
																			purchase.cancelledAt,
																		)}
																	</div>
																)}
																{purchase.trialEnd && (
																	<div>
																		<span className="font-medium">
																			Trial
																			ends:{" "}
																		</span>
																		{formatDate(
																			purchase.trialEnd,
																		)}
																	</div>
																)}
																{purchase.cachedCouponName && (
																	<div>
																		<span className="font-medium">
																			Coupon:{" "}
																		</span>
																		{
																			purchase.cachedCouponName
																		}
																		{purchase.cachedDiscountPercent
																			? ` (${purchase.cachedDiscountPercent}% off)`
																			: ""}
																	</div>
																)}
																{purchase.referralCode && (
																	<div>
																		<span className="font-medium">
																			Referral:{" "}
																		</span>
																		{
																			purchase.referralCode
																		}
																	</div>
																)}
															</div>
															<div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
																<span>
																	Stripe:{" "}
																	{
																		purchase.customerId
																	}
																</span>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-5 w-5 p-0"
																	onClick={() =>
																		copyToClipboard(
																			purchase.customerId,
																			"Customer ID",
																		)
																	}
																>
																	<Copy className="h-3 w-3" />
																</Button>
															</div>
															{purchase.subscriptionId && (
																<div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
																	<span>
																		Sub:{" "}
																		{
																			purchase.subscriptionId
																		}
																	</span>
																	<Button
																		variant="ghost"
																		size="sm"
																		className="h-5 w-5 p-0"
																		onClick={() =>
																			copyToClipboard(
																				purchase.subscriptionId!,
																				"Subscription ID",
																			)
																		}
																	>
																		<Copy className="h-3 w-3" />
																	</Button>
																</div>
															)}
														</div>
													),
												)}
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>
								<Separator />
							</>
						)}

					{/* Affiliate Information */}
					{(user.referredBySlug ||
						user.isAffiliate !== undefined) && (
						<>
							<div className="space-y-4">
								<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
									Affiliate & Referral
								</h4>
								<div className="space-y-3">
									{user.referredBySlug && (
										<div className="flex justify-between py-2">
											<span className="text-sm text-muted-foreground">
												Referred By
											</span>
											<span className="text-sm font-medium">
												@{user.referredBySlug}
											</span>
										</div>
									)}
									<div className="flex justify-between py-2">
										<span className="text-sm text-muted-foreground">
											Affiliate Program
										</span>
										<Badge
											className={
												user.isAffiliate
													? "bg-green-500/10 text-green-500"
													: "bg-muted/60 text-muted-foreground"
											}
										>
											{user.isAffiliate
												? "Connected"
												: "Not Enrolled"}
										</Badge>
									</div>

									{/* Rewardful affiliate details */}
									{user.affiliateData && (
										<div className="mt-3 p-3 rounded-lg border bg-card space-y-3">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<TrendingUp className="h-4 w-4 text-muted-foreground" />
													<span className="text-sm font-medium">
														@
														{
															user.affiliateData
																.slug
														}
													</span>
												</div>
												<Badge
													className={
														user.affiliateData
															.status === "active"
															? "bg-green-500/10 text-green-500"
															: "bg-muted/60 text-muted-foreground"
													}
												>
													{user.affiliateData.status}
												</Badge>
											</div>

											{user.affiliateData
												.primaryLinkUrl && (
												<div className="flex items-center gap-2 text-xs text-muted-foreground">
													<ExternalLink className="h-3 w-3" />
													<a
														href={
															user.affiliateData
																.primaryLinkUrl
														}
														target="_blank"
														rel="noopener noreferrer"
														className="hover:underline truncate max-w-[320px]"
													>
														{
															user.affiliateData
																.primaryLinkUrl
														}
													</a>
													<Button
														variant="ghost"
														size="sm"
														className="h-5 w-5 p-0"
														onClick={() => {
															const url =
																user
																	.affiliateData
																	?.primaryLinkUrl;
															if (url) {
																copyToClipboard(
																	url,
																	"Affiliate link",
																);
															}
														}}
													>
														<Copy className="h-3 w-3" />
													</Button>
												</div>
											)}

											<div className="grid grid-cols-3 gap-3 text-center tabular-nums">
												<div>
													<div className="text-lg font-bold">
														{
															user.affiliateData
																.visitors
														}
													</div>
													<div className="text-xs text-muted-foreground">
														Visitors
													</div>
												</div>
												<div>
													<div className="text-lg font-bold">
														{
															user.affiliateData
																.leads
														}
													</div>
													<div className="text-xs text-muted-foreground">
														Leads
													</div>
												</div>
												<div>
													<div className="text-lg font-bold">
														{
															user.affiliateData
																.conversions
														}
													</div>
													<div className="text-xs text-muted-foreground">
														Conversions
													</div>
												</div>
											</div>

											<div className="grid grid-cols-3 gap-3 text-center border-t pt-3 tabular-nums">
												<div>
													<div className="text-sm font-semibold text-green-600 dark:text-green-400">
														{formatCents(
															user.affiliateData
																.commissionsPaid,
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														Paid
													</div>
												</div>
												<div>
													<div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
														{formatCents(
															user.affiliateData
																.commissionsPending,
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														Pending
													</div>
												</div>
												<div>
													<div className="text-sm font-semibold">
														{formatCents(
															user.affiliateData
																.commissionsEarned,
														)}
													</div>
													<div className="text-xs text-muted-foreground">
														Total Earned
													</div>
												</div>
											</div>

											<div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 tabular-nums">
												<span>
													Rewardful ID:{" "}
													<span className="font-mono">
														{
															user.affiliateData
																.rewardfulId
														}
													</span>
												</span>
												<span>
													Synced:{" "}
													{user.affiliateData
														.lastSyncAt
														? formatDate(
																user
																	.affiliateData
																	.lastSyncAt,
															)
														: "Never"}
												</span>
											</div>
										</div>
									)}
								</div>
							</div>
							<Separator />
						</>
					)}

					{/* Beta Features */}
					{user.betaFeatures && user.betaFeatures.length > 0 && (
						<>
							<div className="space-y-4">
								<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
									Beta Features
								</h4>
								<div className="flex flex-wrap gap-2">
									{betaFeaturesToShow.map((feature) => (
										<Badge
											key={feature}
											status="info"
											className="bg-purple-500/10 text-purple-500"
										>
											{feature}
										</Badge>
									))}
								</div>
								{hasMoreBetaFeatures && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											setBetaFeaturesExpanded(
												!betaFeaturesExpanded,
											)
										}
										className="text-xs"
									>
										{betaFeaturesExpanded
											? "Show Less"
											: `Show ${(user.betaFeatures?.length || 0) - 6} more`}
									</Button>
								)}
							</div>
							<Separator />
						</>
					)}

					{/* Recent Sessions */}
					{user.recentSessions && user.recentSessions.length > 0 && (
						<>
							<Accordion
								type="single"
								collapsible
								className="w-full"
							>
								<AccordionItem value="sessions">
									<AccordionTrigger>
										<div className="flex items-center gap-2">
											<Clock className="h-4 w-4 text-muted-foreground" />
											<span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
												Recent Login Sessions (
												{user.recentSessions.length})
											</span>
										</div>
									</AccordionTrigger>
									<AccordionContent>
										<div className="space-y-3 pt-2">
											{user.recentSessions.map(
												(session, index) => (
													<div
														key={index}
														className="p-3 rounded-lg border bg-card space-y-1"
													>
														<div className="flex items-center gap-2 text-sm">
															<Clock className="h-3 w-3 text-muted-foreground" />
															<span className="font-medium">
																{formatDate(
																	session.createdAt,
																)}
															</span>
														</div>
														{session.ipAddress && (
															<div className="flex items-center gap-2 text-xs text-muted-foreground">
																<span>📍</span>
																<span>
																	{
																		session.ipAddress
																	}
																</span>
															</div>
														)}
														{session.userAgent && (
															<div className="flex items-center gap-2 text-xs text-muted-foreground">
																<span>💻</span>
																<span>
																	{parseUserAgent(
																		session.userAgent,
																	)}
																</span>
															</div>
														)}
													</div>
												),
											)}
										</div>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
							<Separator />
						</>
					)}

					{/* Account Details */}
					<div className="space-y-4">
						<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
							Account Details
						</h4>
						<div className="space-y-3">
							<div className="flex justify-between py-2">
								<span className="text-sm text-muted-foreground">
									User ID
								</span>
								<div className="flex items-center gap-2">
									<span className="text-sm font-mono">
										{user.id}
									</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() =>
											copyToClipboard(user.id, "User ID")
										}
									>
										<Copy className="h-3 w-3" />
									</Button>
								</div>
							</div>
							<div className="flex justify-between py-2">
								<span className="text-sm text-muted-foreground">
									Account Email
								</span>
								<div className="flex items-center gap-2">
									<span className="text-sm">
										{user.email}
									</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() =>
											copyToClipboard(user.email, "Email")
										}
									>
										<Copy className="h-3 w-3" />
									</Button>
								</div>
							</div>
							{user.stripeEmail && (
								<div className="flex justify-between py-2">
									<span className="text-sm text-muted-foreground">
										Stripe Email
									</span>
									<div className="flex items-center gap-2">
										<span className="text-sm">
											{user.stripeEmail}
										</span>
										<Button
											variant="ghost"
											size="sm"
											className="h-6 w-6 p-0"
											onClick={() =>
												copyToClipboard(
													user.stripeEmail!,
													"Stripe email",
												)
											}
										>
											<Copy className="h-3 w-3" />
										</Button>
									</div>
								</div>
							)}
							{user.notificationEmail &&
								user.notificationEmail !== user.email && (
									<div className="flex justify-between py-2">
										<span className="text-sm text-muted-foreground">
											Notification Email
										</span>
										<div className="flex items-center gap-2">
											<span className="text-sm">
												{user.notificationEmail}
											</span>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												onClick={() =>
													copyToClipboard(
														user.notificationEmail!,
														"Notification email",
													)
												}
											>
												<Copy className="h-3 w-3" />
											</Button>
										</div>
									</div>
								)}
							<div className="flex justify-between py-2">
								<span className="text-sm text-muted-foreground">
									Email Verified
								</span>
								<Badge
									className={
										user.emailVerified
											? "bg-green-500/10 text-green-500"
											: "bg-muted/60 text-muted-foreground"
									}
								>
									{user.emailVerified
										? "Verified"
										: "Not Verified"}
								</Badge>
							</div>
							{user.lastLogin && (
								<div className="flex justify-between py-2">
									<span className="text-sm text-muted-foreground">
										Last Login
									</span>
									<span className="text-sm tabular-nums">
										{formatDate(user.lastLogin)}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Connected Authentication Methods */}
					{user.connectedAccounts &&
						user.connectedAccounts.length > 0 && (
							<>
								<Separator />
								<div className="space-y-4">
									<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
										Connected Authentication Methods
									</h4>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{user.connectedAccounts.map(
											(account) => {
												const getProviderName = (
													providerId: string,
												) => {
													if (
														providerId ===
														"credential"
													) {
														return "Email/Password";
													}
													return (
														providerId
															.charAt(0)
															.toUpperCase() +
														providerId.slice(1)
													);
												};

												const getProviderIcon = (
													providerId: string,
												) => {
													if (
														providerId ===
														"credential"
													) {
														return (
															<Mail className="h-4 w-4 text-muted-foreground" />
														);
													}
													if (
														providerId === "google"
													) {
														return (
															<svg
																className="h-4 w-4"
																viewBox="0 0 24 24"
																fill="none"
																role="img"
																aria-labelledby="google-provider-icon-title"
															>
																<title id="google-provider-icon-title">
																	Google
																</title>
																<path
																	fill="#4285F4"
																	d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
																/>
																<path
																	fill="#34A853"
																	d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
																/>
																<path
																	fill="#FBBC05"
																	d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
																/>
																<path
																	fill="#EA4335"
																	d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
																/>
															</svg>
														);
													}
													if (
														providerId === "discord"
													) {
														return (
															<MessageCircle className="h-4 w-4 text-muted-foreground" />
														);
													}
													return (
														<Link2 className="h-4 w-4 text-muted-foreground" />
													);
												};

												return (
													<div
														key={account.providerId}
														className="flex items-center justify-between p-3 rounded-lg border bg-card"
													>
														<div className="flex items-center gap-3">
															{getProviderIcon(
																account.providerId,
															)}
															<span className="text-sm font-medium">
																{getProviderName(
																	account.providerId,
																)}
															</span>
														</div>
														<CheckCircle2 className="h-4 w-4 text-green-500" />
													</div>
												);
											},
										)}
									</div>
									{user.connectedAccounts.length > 0 && (
										<p className="text-xs text-muted-foreground tabular-nums">
											First connected:{" "}
											{formatDate(
												user.connectedAccounts[0]
													?.createdAt,
											)}
										</p>
									)}
								</div>
							</>
						)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
