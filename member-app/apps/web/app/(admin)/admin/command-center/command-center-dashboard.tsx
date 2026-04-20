"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "@/modules/ui/icons";

function formatUsd(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function formatDateTime(iso: string | null): string {
	if (!iso) {
		return "—";
	}
	try {
		return new Intl.DateTimeFormat("en-US", {
			dateStyle: "medium",
			timeStyle: "short",
		}).format(new Date(iso));
	} catch {
		return "—";
	}
}

interface WatchRow {
	purchaseId: string;
	userId: string;
	name: string;
	email: string;
	href: string;
	status: string | null;
	currentPeriodEnd: string | null;
	cancelledAt: string | null;
	cancelAtPeriodEnd?: boolean;
}

function WatchlistTable({
	title,
	description,
	rows,
	emptyLabel,
	extraColumns,
}: {
	title: string;
	description: string;
	rows: WatchRow[];
	emptyLabel: string;
	extraColumns?: { header: string; cell: (row: WatchRow) => ReactNode }[];
}) {
	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle className="text-lg">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="flex-1 overflow-x-auto">
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{emptyLabel}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Status</TableHead>
								{extraColumns?.map((c) => (
									<TableHead key={c.header}>
										{c.header}
									</TableHead>
								))}
								<TableHead className="w-[100px]">
									Open
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={row.purchaseId}>
									<TableCell className="font-medium">
										{row.name}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{row.email}
									</TableCell>
									<TableCell>
										{row.status ? (
											<Badge
												status="info"
												className="text-xs capitalize"
											>
												{row.status.replace(/_/g, " ")}
											</Badge>
										) : (
											"—"
										)}
									</TableCell>
									{extraColumns?.map((c) => (
										<TableCell key={c.header}>
											{c.cell(row)}
										</TableCell>
									))}
									<TableCell>
										<Link
											href={row.href}
											className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
										>
											Profile
											<ExternalLink className="h-3 w-3" />
										</Link>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

export function CommandCenterDashboard() {
	const snapshotQuery = useQuery(
		orpc.admin.commandCenter.snapshot.queryOptions({
			input: {},
		}),
	);

	if (snapshotQuery.isPending) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-64" />
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-48 rounded-lg" />
					))}
				</div>
				<Skeleton className="h-64 rounded-lg" />
			</div>
		);
	}

	if (snapshotQuery.isError) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Could not load command center</CardTitle>
					<CardDescription>
						{snapshotQuery.error instanceof Error
							? snapshotQuery.error.message
							: "Unknown error"}
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const data = snapshotQuery.data;

	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-3xl font-bold tracking-tight text-balance">
					Command Center
				</h1>
				<p className="text-muted-foreground mt-2 text-pretty max-w-3xl">
					Owner snapshot: customer success watchlists, Stripe webhook
					activity signals, and current MRR (same basis as the
					Analytics revenue tab).
				</p>
			</div>

			<Card className="border-primary/30 bg-primary/5">
				<CardHeader className="pb-2">
					<CardDescription>MRR snapshot</CardDescription>
					<CardTitle className="text-3xl tabular-nums">
						{formatUsd(data.mrrCents)}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						Sum of monthly-equivalent recurring revenue from active,
						trialing, and grace-period subscriptions (cached Stripe
						amounts).
					</p>
				</CardContent>
			</Card>

			<div>
				<h2 className="text-xl font-semibold tracking-tight mb-4">
					Customer success watchlist
				</h2>
				<div className="grid gap-4 lg:grid-cols-2">
					<WatchlistTable
						title="In grace period"
						description="Subscriptions currently in payment grace period."
						rows={data.watchlist.gracePeriod}
						emptyLabel="No users in grace period."
						extraColumns={[
							{
								header: "Period end",
								cell: (row) =>
									formatDateTime(row.currentPeriodEnd),
							},
						]}
					/>
					<WatchlistTable
						title="Canceled in the last 14 days"
						description="Subscription purchases marked canceled recently."
						rows={data.watchlist.canceledLast14Days}
						emptyLabel="No recent cancellations."
						extraColumns={[
							{
								header: "Canceled",
								cell: (row) => formatDateTime(row.cancelledAt),
							},
						]}
					/>
					<WatchlistTable
						title="Subscribed 7+ days, no Discord"
						description="Active-style subscribers who still have not connected Discord."
						rows={data.watchlist.subscribedNoDiscordAfter7Days}
						emptyLabel="No matching subscribers."
					/>
					<WatchlistTable
						title="Scheduled cancel within 7 days"
						description="cancelAtPeriodEnd with access ending this week."
						rows={data.watchlist.cancelAtPeriodEndWithin7Days}
						emptyLabel="No upcoming scheduled ends."
						extraColumns={[
							{
								header: "Access ends",
								cell: (row) =>
									formatDateTime(row.currentPeriodEnd),
							},
						]}
					/>
				</div>
			</div>

			<div>
				<h2 className="text-xl font-semibold tracking-tight mb-4">
					System status
				</h2>
				<div className="grid gap-4 lg:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								Cron signals
							</CardTitle>
							<CardDescription>
								Inferred from database timestamps where
								available; otherwise check Vercel cron logs.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{data.systemStatus.cronSignals.map((job) => (
								<div
									key={job.id}
									className="border-b border-border pb-3 last:border-0 last:pb-0"
								>
									<p className="font-medium text-sm">
										{job.label}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										Last signal:{" "}
										{job.lastRunAt
											? formatDateTime(job.lastRunAt)
											: "Not available"}
									</p>
									<p className="text-xs text-muted-foreground mt-1">
										{job.detail}
									</p>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-lg">
								Stripe webhooks
							</CardTitle>
							<CardDescription>
								Latest processed event time per Stripe type
								(idempotency table).
							</CardDescription>
						</CardHeader>
						<CardContent>
							{data.systemStatus.stripeWebhooks.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No processed webhook rows yet.
								</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Type</TableHead>
											<TableHead>
												Last processed
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{data.systemStatus.stripeWebhooks.map(
											(w) => (
												<TableRow key={w.type}>
													<TableCell className="font-mono text-xs">
														{w.type}
													</TableCell>
													<TableCell className="text-sm">
														{formatDateTime(
															w.lastProcessedAt,
														)}
													</TableCell>
												</TableRow>
											),
										)}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</div>

				{data.systemStatus.discordIssueNotification && (
					<Card className="mt-4 border-amber-500/40">
						<CardHeader>
							<CardTitle className="text-lg">
								Latest Discord health notification
							</CardTitle>
							<CardDescription>
								From admin notifications (cron or manual sync
								check).{" "}
								{formatDateTime(
									data.systemStatus.discordIssueNotification
										.createdAt,
								)}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<p className="font-medium text-sm">
								{
									data.systemStatus.discordIssueNotification
										.title
								}
							</p>
							<p className="text-sm text-muted-foreground whitespace-pre-wrap">
								{
									data.systemStatus.discordIssueNotification
										.messagePreview
								}
								{data.systemStatus.discordIssueNotification
									.messagePreview.length >= 240
									? "…"
									: ""}
							</p>
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
