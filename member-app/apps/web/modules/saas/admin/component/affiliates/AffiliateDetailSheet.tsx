"use client";

import type { AffiliateWithMetrics } from "@repo/api/modules/admin/types";
import { AffiliateStatusBadge } from "@saas/admin/component/StatusBadges";
import {
	formatCurrency,
	formatDate,
	formatRelativeTime,
	getInitials,
} from "@saas/admin/lib/subscription-utils";
import { orpcClient } from "@shared/lib/orpc-client";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@ui/components/sheet";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	Check,
	Copy,
	Link2,
	Link2Off,
	Loader2,
	MousePointer2,
	RefreshCw,
	TrendingUp,
	Users,
} from "@/modules/ui/icons";

type AffiliateDetailsEntry =
	| { status: "loading" }
	| { status: "error"; message: string }
	| {
			status: "loaded";
			loadedAt: string;
			links: Array<{
				token: string;
				visitors: number;
				conversions: number;
			}>;
			recentConversions: Array<{
				customerName: string;
				date: string | null;
				saleAmountCents: number;
				commissionAmountCents: number;
				state: string;
			}>;
	  };

interface AffiliateDetailSheetProps {
	affiliate: AffiliateWithMetrics | null;
	open: boolean;
	onClose: () => void;
	onSync: (rewardfulId: string, name: string) => void;
	onUnlink: (rewardfulId: string, name: string, email: string) => void;
	onCreateAccount: (affiliate: AffiliateWithMetrics) => void;
	unlinkingId: string | null;
}

export function AffiliateDetailSheet({
	affiliate,
	open,
	onClose,
	onSync,
	onUnlink,
	onCreateAccount,
	unlinkingId,
}: AffiliateDetailSheetProps) {
	const [details, setDetails] = useState<AffiliateDetailsEntry | null>(null);
	const [copiedId, setCopiedId] = useState(false);

	// Reset details when the selected affiliate changes
	useEffect(() => {
		setDetails(null);
	}, [affiliate?.rewardfulId]);

	const loadDetails = useCallback(async (rewardfulId: string) => {
		setDetails({ status: "loading" });
		try {
			const result = await orpcClient.admin.rewardful.getDetails({
				affiliateId: rewardfulId,
			});
			setDetails({
				status: "loaded",
				loadedAt: new Date().toISOString(),
				links: result.links,
				recentConversions: result.recentConversions,
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to load details from Rewardful";
			setDetails({ status: "error", message });
			toast.error(message);
		}
	}, []);

	const handleCopyId = useCallback((id: string) => {
		navigator.clipboard.writeText(id);
		setCopiedId(true);
		toast.success("Rewardful ID copied");
		setTimeout(() => setCopiedId(false), 2000);
	}, []);

	if (!affiliate) {
		return null;
	}

	return (
		<Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
			<SheetContent
				side="right"
				className="flex flex-col overflow-x-hidden overflow-y-auto p-0 !w-[680px] !max-w-[680px]"
			>
				<SheetHeader className="sr-only">
					<SheetTitle>
						{affiliate.name} — Affiliate Details
					</SheetTitle>
				</SheetHeader>

				{/* Header */}
				<div className="flex items-start gap-4 border-b border-border p-6">
					<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/10 text-lg font-bold text-[#FF6B35]">
						{getInitials(affiliate.name)}
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-lg font-semibold">
								{affiliate.name}
							</h2>
							<AffiliateStatusBadge status={affiliate.status} />
							{!affiliate.hasUserAccount && (
								<Badge className="border-red-500/30 bg-red-500/10 text-xs text-red-500">
									No User
								</Badge>
							)}
						</div>
						<p className="text-sm text-muted-foreground">
							{affiliate.email}
						</p>
						<p className="text-xs text-muted-foreground">
							Joined {formatDate(affiliate.joinDate)}
							{affiliate.lastSyncAt
								? ` · Synced ${formatRelativeTime(affiliate.lastSyncAt)}`
								: ""}
						</p>
					</div>
					<div className="shrink-0">
						{affiliate.hasUserAccount ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									onSync(
										affiliate.rewardfulId,
										affiliate.name,
									)
								}
							>
								<RefreshCw className="mr-1 h-3 w-3" />
								Sync
							</Button>
						) : (
							<Button
								size="sm"
								variant="outline"
								onClick={() => onCreateAccount(affiliate)}
								className="border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
							>
								<Users className="mr-1 h-3 w-3" />
								Create Account
							</Button>
						)}
					</div>
				</div>

				{/* Quick stats strip */}
				<div className="grid min-w-0 grid-cols-3 divide-x divide-border border-b border-border">
					<div className="p-4 text-center">
						<div className="flex items-center justify-center gap-1.5">
							<MousePointer2 className="h-4 w-4 text-muted-foreground" />
							<p className="text-2xl font-bold tabular-nums">
								{affiliate.totalClicks.toLocaleString()}
							</p>
						</div>
						<p className="text-xs text-muted-foreground">Clicks</p>
					</div>
					<div className="p-4 text-center">
						<div className="flex items-center justify-center gap-1.5">
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
							<p className="text-2xl font-bold tabular-nums">
								{affiliate.conversions}
							</p>
						</div>
						<p className="text-xs text-muted-foreground">
							Conversions ({affiliate.conversionRate}%)
						</p>
					</div>
					<div className="p-4 text-center">
						<p className="text-2xl font-bold tabular-nums text-[#FF6B35]">
							{formatCurrency(affiliate.totalEarnings)}
						</p>
						<p className="text-xs text-muted-foreground">
							{formatCurrency(affiliate.pendingEarnings)} pending
						</p>
					</div>
				</div>

				{/* Body */}
				<div className="grid flex-1 grid-cols-1 gap-6 p-6 min-[600px]:grid-cols-[1fr_220px]">
					{/* Left: Tracking Links + Recent Conversions */}
					<div className="space-y-6">
						{/* Tracking Links + Conversions: load on demand */}
						{!details && (
							<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 py-12 text-center">
								<p className="text-sm text-muted-foreground">
									Load live tracking links and recent
									conversions from Rewardful.
								</p>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										loadDetails(affiliate.rewardfulId)
									}
								>
									Load Details
								</Button>
							</div>
						)}

						{details?.status === "loading" && (
							<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 py-12">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
								<p className="text-sm text-muted-foreground">
									Fetching from Rewardful...
								</p>
							</div>
						)}

						{details?.status === "error" && (
							<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 py-12 text-center">
								<AlertCircle className="h-5 w-5 text-destructive" />
								<p className="text-sm text-muted-foreground">
									{details.message}
								</p>
								<Button
									size="sm"
									variant="outline"
									onClick={() =>
										loadDetails(affiliate.rewardfulId)
									}
								>
									Try Again
								</Button>
							</div>
						)}

						{details?.status === "loaded" && (
							<>
								{/* Tracking Links */}
								<div>
									<div className="mb-3 flex items-center gap-2">
										<Link2 className="h-4 w-4 text-muted-foreground" />
										<h4 className="text-sm font-medium">
											Tracking Links
										</h4>
										<Button
											size="sm"
											variant="ghost"
											className="ml-auto h-5 w-5 p-0 text-muted-foreground"
											onClick={() =>
												loadDetails(
													affiliate.rewardfulId,
												)
											}
											title="Refresh from Rewardful"
										>
											<RefreshCw className="h-3 w-3" />
										</Button>
										<span className="text-[11px] text-muted-foreground">
											Updated{" "}
											{formatRelativeTime(
												details.loadedAt,
											)}
										</span>
									</div>
									{details.links.length === 0 ? (
										<p className="text-xs italic text-muted-foreground">
											No links found
										</p>
									) : (
										<div className="space-y-1.5">
											{details.links
												.slice(0, 5)
												.map((link, idx) => (
													<div
														key={idx}
														className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-md border border-border bg-background px-3 py-2 text-xs"
													>
														<code className="truncate font-mono font-semibold text-primary">
															?via={link.token}
														</code>
														<span className="tabular-nums text-muted-foreground">
															{link.visitors.toLocaleString()}{" "}
															clicks
														</span>
														<span className="tabular-nums text-muted-foreground">
															{link.conversions}{" "}
															conv
														</span>
													</div>
												))}
											{details.links.length > 5 && (
												<p className="text-xs text-muted-foreground">
													+{details.links.length - 5}{" "}
													more in Rewardful
												</p>
											)}
										</div>
									)}
								</div>

								{/* Recent Conversions */}
								<div>
									<h4 className="mb-3 text-sm font-medium">
										Recent Conversions
									</h4>
									{details.recentConversions.length === 0 ? (
										<p className="text-xs italic text-muted-foreground">
											No conversions yet
										</p>
									) : (
										<div className="overflow-hidden rounded-lg border border-border">
											<table className="w-full text-xs">
												<thead>
													<tr className="border-b border-border bg-muted/50">
														<th className="px-3 py-2 text-left font-medium text-muted-foreground">
															Customer
														</th>
														<th className="px-3 py-2 text-left font-medium text-muted-foreground">
															Date
														</th>
														<th className="px-3 py-2 text-right font-medium text-muted-foreground">
															Sale
														</th>
														<th className="px-3 py-2 text-right font-medium text-muted-foreground">
															Comm.
														</th>
														<th className="px-3 py-2 text-right font-medium text-muted-foreground">
															Status
														</th>
													</tr>
												</thead>
												<tbody>
													{details.recentConversions.map(
														(conv, idx) => (
															<tr
																key={idx}
																className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
															>
																<td className="px-3 py-2 font-medium">
																	{
																		conv.customerName
																	}
																</td>
																<td className="px-3 py-2 tabular-nums text-muted-foreground">
																	{conv.date
																		? formatDate(
																				conv.date,
																			)
																		: "—"}
																</td>
																<td className="px-3 py-2 text-right tabular-nums font-medium">
																	{formatCurrency(
																		conv.saleAmountCents /
																			100,
																	)}
																</td>
																<td className="px-3 py-2 text-right tabular-nums font-semibold text-[#FF6B35]">
																	{formatCurrency(
																		conv.commissionAmountCents /
																			100,
																	)}
																</td>
																<td className="px-3 py-2 text-right">
																	<span
																		className={
																			conv.state ===
																			"paid"
																				? "inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-500"
																				: conv.state ===
																						"pending"
																					? "inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-500"
																					: conv.state ===
																							"due"
																						? "inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-500"
																						: "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
																		}
																	>
																		{
																			conv.state
																		}
																	</span>
																</td>
															</tr>
														),
													)}
												</tbody>
											</table>
										</div>
									)}
								</div>
							</>
						)}
					</div>

					{/* Right: Earnings + Rewardful ID + User Account */}
					<div className="space-y-4">
						{/* Earnings Breakdown */}
						<div className="rounded-lg border border-border p-4">
							<h4 className="mb-3 text-sm font-medium">
								Earnings Breakdown
							</h4>
							<div className="space-y-2.5">
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Pending
									</span>
									<span className="tabular-nums font-medium text-yellow-500">
										{formatCurrency(
											affiliate.pendingEarnings,
										)}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Due
									</span>
									<span className="tabular-nums font-medium text-blue-500">
										{formatCurrency(affiliate.dueEarnings)}
									</span>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-muted-foreground">
										Paid
									</span>
									<span className="tabular-nums font-medium text-green-500">
										{formatCurrency(affiliate.paidEarnings)}
									</span>
								</div>
								<div className="flex items-center justify-between border-t border-border pt-2.5">
									<span className="font-medium">Total</span>
									<span className="tabular-nums font-bold text-[#FF6B35]">
										{formatCurrency(
											affiliate.totalEarnings,
										)}
									</span>
								</div>
							</div>
						</div>

						{/* Rewardful ID */}
						<div>
							<p className="mb-1.5 text-xs text-muted-foreground">
								Rewardful Affiliate ID
							</p>
							<div className="flex items-center gap-2">
								<code className="flex-1 truncate rounded border border-border bg-muted/50 px-2 py-1.5 font-mono text-xs">
									{affiliate.rewardfulId}
								</code>
								<Button
									size="sm"
									variant="ghost"
									onClick={() =>
										handleCopyId(affiliate.rewardfulId)
									}
									className="h-7 w-7 shrink-0 p-0"
								>
									{copiedId ? (
										<Check className="h-3 w-3 text-green-500" />
									) : (
										<Copy className="h-3 w-3" />
									)}
								</Button>
							</div>
						</div>

						{/* No User Account Warning */}
						{!affiliate.hasUserAccount && (
							<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
								<p className="mb-2 text-xs font-medium text-amber-700">
									No User Account
								</p>
								<p className="mb-3 text-xs text-muted-foreground">
									This affiliate exists in Rewardful but has
									no app account.
								</p>
								<div className="flex gap-2">
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											onCreateAccount(affiliate)
										}
										className="h-7 text-[11px] border-amber-500/30 bg-amber-500/10 text-amber-700"
									>
										<Users className="mr-1 h-3 w-3" />
										Create Account
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											navigator.clipboard.writeText(
												affiliate.email,
											);
											toast.success("Email copied");
										}}
										className="h-7 text-[11px]"
									>
										<Copy className="mr-1 h-3 w-3" />
										Copy Email
									</Button>
								</div>
							</div>
						)}

						{/* User Account Info */}
						{affiliate.hasUserAccount &&
							(affiliate.userAccountName ||
								affiliate.userAccountEmail) && (
								<div className="rounded-lg border border-border bg-muted/20 p-3">
									<div className="mb-2 flex items-center justify-between">
										<h5 className="flex items-center gap-1.5 text-xs font-medium">
											<Users className="h-3 w-3" />
											User Account
										</h5>
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												onUnlink(
													affiliate.rewardfulId,
													affiliate.name,
													affiliate.userAccountEmail ||
														affiliate.email,
												)
											}
											disabled={
												unlinkingId ===
												affiliate.rewardfulId
											}
											className="h-6 text-[10px] border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20"
										>
											{unlinkingId ===
											affiliate.rewardfulId ? (
												<RefreshCw className="mr-1 h-3 w-3 animate-spin" />
											) : (
												<Link2Off className="mr-1 h-3 w-3" />
											)}
											Unlink
										</Button>
									</div>
									<div className="space-y-1.5 text-xs">
										{affiliate.userAccountName && (
											<div className="flex items-center gap-2">
												<span className="w-12 text-muted-foreground">
													Name
												</span>
												<span className="flex-1 font-medium">
													{affiliate.userAccountName}
												</span>
												{affiliate.userAccountName !==
													affiliate.name && (
													<Badge className="h-4 text-[10px]">
														Differs
													</Badge>
												)}
											</div>
										)}
										{affiliate.userAccountEmail && (
											<div className="flex items-center gap-2">
												<span className="w-12 text-muted-foreground">
													Email
												</span>
												<span className="flex-1 truncate font-medium">
													{affiliate.userAccountEmail}
												</span>
												{affiliate.userAccountEmail.toLowerCase() !==
													affiliate.email.toLowerCase() && (
													<Badge className="h-4 text-[10px]">
														Differs
													</Badge>
												)}
											</div>
										)}
										<p className="pt-1 text-[11px] italic text-muted-foreground">
											Rewardful: {affiliate.name} ·{" "}
											{affiliate.email}
										</p>
									</div>
								</div>
							)}
					</div>
				</div>
			</SheetContent>
		</Sheet>
	);
}
