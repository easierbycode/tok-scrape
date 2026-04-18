"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Skeleton } from "@ui/components/skeleton";
import { useState } from "react";

interface StatCardProps {
	title: string;
	value: string | number;
	sub: string;
	trend?: "up" | "down" | "neutral";
}

function StatCard({ title, value, sub, trend }: StatCardProps) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<CardTitle className="text-sm text-muted-foreground font-medium">
					{title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<p
					className={`text-3xl font-bold ${
						trend === "up"
							? "text-emerald-500"
							: trend === "down"
								? "text-rose-500"
								: ""
					}`}
				>
					{value}
				</p>
				<p className="text-xs text-muted-foreground mt-1">{sub}</p>
			</CardContent>
		</Card>
	);
}

export function DiscordAnalyticsDashboard() {
	const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">(
		"30d",
	);

	const { data, isLoading } = useQuery(
		orpc.admin.discord.analytics.queryOptions({ input: { timeRange } }),
	);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-10 w-48" />
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-32" />
					))}
				</div>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	const { overview, actions } = data;

	const netGrowth = overview.newConnections - overview.disconnections;
	const recoveryPct =
		overview.gracePeriodChanges > 0
			? Math.round(
					(overview.gracePeriodRecoveries /
						overview.gracePeriodChanges) *
						100,
				)
			: 0;

	return (
		<div className="space-y-6">
			{/* Time Range Selector */}
			<div className="flex items-center gap-4">
				<span className="text-sm font-medium">Time Range:</span>
				<Select
					value={timeRange}
					onValueChange={(v) =>
						setTimeRange(v as "7d" | "30d" | "90d" | "all")
					}
				>
					<SelectTrigger className="w-36">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="7d">Last 7 days</SelectItem>
						<SelectItem value="30d">Last 30 days</SelectItem>
						<SelectItem value="90d">Last 90 days</SelectItem>
						<SelectItem value="all">All time</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Overview Stats */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<StatCard
					title="Total Connected"
					value={overview.totalConnections}
					sub={`+${overview.newConnections} new this period`}
				/>
				<StatCard
					title="Net Growth"
					value={netGrowth >= 0 ? `+${netGrowth}` : netGrowth}
					sub={`${overview.newConnections} joined · ${overview.disconnections} left`}
					trend={
						netGrowth > 0
							? "up"
							: netGrowth < 0
								? "down"
								: "neutral"
					}
				/>
				<StatCard
					title="Grace Period Recovery"
					value={`${recoveryPct}%`}
					sub={`${overview.gracePeriodRecoveries} of ${overview.gracePeriodChanges} recovered`}
					trend={recoveryPct >= 50 ? "up" : "down"}
				/>
				<StatCard
					title="Spouse Accounts"
					value={overview.spouseAccounts}
					sub={`+${overview.newSpouseAccounts} new this period`}
				/>
			</div>

			{/* Action Breakdown */}
			{actions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Action Breakdown</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-1">
							{actions.map((action) => (
								<div
									key={action.action}
									className="flex items-center justify-between py-2 border-b last:border-0"
								>
									<span className="font-medium capitalize text-sm">
										{action.action.replace(/_/g, " ")}
									</span>
									<span className="text-muted-foreground text-sm tabular-nums">
										{action.count}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{actions.length === 0 && (
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground text-sm">
						No activity recorded for the selected time range.
					</CardContent>
				</Card>
			)}
		</div>
	);
}
