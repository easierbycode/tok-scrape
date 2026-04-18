"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Skeleton } from "@ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

const CHART_COLORS = [
	"hsl(var(--primary))",
	"hsl(199 89% 48%)",
	"hsl(142 71% 45%)",
	"hsl(48 96% 53%)",
	"hsl(280 65% 60%)",
	"hsl(24 95% 53%)",
];

function formatUsd(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function ChartSkeleton() {
	return <Skeleton className="h-[280px] w-full rounded-lg" />;
}

interface AnalyticsDashboardProps {
	dashboardEmbedUrl: string | null;
}

export function AnalyticsDashboard({
	dashboardEmbedUrl,
}: AnalyticsDashboardProps) {
	const [discordRange, setDiscordRange] = useState<
		"7d" | "30d" | "90d" | "all"
	>("30d");

	const revenueQuery = useQuery(
		orpc.admin.analytics.revenue.queryOptions({
			input: { months: 12 },
		}),
	);

	const lifecycleQuery = useQuery(
		orpc.admin.analytics.lifecycle.queryOptions({
			input: { months: 12 },
		}),
	);

	const discordQuery = useQuery(
		orpc.admin.discord.analytics.queryOptions({
			input: { timeRange: discordRange },
		}),
	);

	const newVsChurn =
		revenueQuery.data?.newSubscribersByMonth.map((n, i) => ({
			month: n.month,
			new: n.count,
			churned: revenueQuery.data.churnedByMonth[i]?.count ?? 0,
		})) ?? [];

	const affiliateData = revenueQuery.data
		? [
				{
					name: "Direct",
					value: revenueQuery.data.affiliateVsDirect.direct,
				},
				{
					name: "Affiliate referral",
					value: revenueQuery.data.affiliateVsDirect
						.withAffiliateReferral,
				},
			]
		: [];

	const planPie =
		revenueQuery.data?.planDistribution.map((p) => ({
			name:
				p.productId.length > 18
					? `${p.productId.slice(0, 16)}…`
					: p.productId,
			value: p.count,
			productId: p.productId,
		})) ?? [];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
				<p className="text-muted-foreground mt-1">
					Revenue, community, product usage, and lifecycle metrics
				</p>
			</div>

			<Tabs defaultValue="revenue" className="space-y-6">
				<TabsList className="flex flex-wrap h-auto gap-1">
					<TabsTrigger value="revenue">Revenue</TabsTrigger>
					<TabsTrigger value="community">Community</TabsTrigger>
					<TabsTrigger value="product">Product usage</TabsTrigger>
					<TabsTrigger value="lifecycle">
						Customer lifecycle
					</TabsTrigger>
				</TabsList>

				<TabsContent value="revenue" className="space-y-6">
					{revenueQuery.isLoading ? (
						<ChartSkeleton />
					) : revenueQuery.data ? (
						<>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Estimated MRR
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-3xl font-bold">
											{formatUsd(
												revenueQuery.data
													.currentMrrCents,
											)}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											From active subscriptions (monthly
											equivalent)
										</p>
									</CardContent>
								</Card>
							</div>

							<Card>
								<CardHeader>
									<CardTitle>MRR trend</CardTitle>
									<CardDescription>
										Reconstructed from subscription records
										(12 months)
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[300px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<LineChart
											data={revenueQuery.data.mrrByMonth}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted"
											/>
											<XAxis
												dataKey="month"
												tick={{ fontSize: 12 }}
											/>
											<YAxis
												tick={{ fontSize: 12 }}
												tickFormatter={(v) =>
													formatUsd(v as number)
												}
											/>
											<Tooltip
												formatter={(value: number) => [
													formatUsd(value),
													"MRR",
												]}
											/>
											<Line
												type="monotone"
												dataKey="mrrCents"
												stroke="hsl(var(--primary))"
												strokeWidth={2}
												dot={false}
												name="MRR"
											/>
										</LineChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>
										New vs churned subscriptions
									</CardTitle>
									<CardDescription>
										By calendar month
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[300px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<BarChart data={newVsChurn}>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted"
											/>
											<XAxis
												dataKey="month"
												tick={{ fontSize: 12 }}
											/>
											<YAxis tick={{ fontSize: 12 }} />
											<Tooltip />
											<Legend />
											<Bar
												dataKey="new"
												fill="hsl(142 71% 45%)"
												name="New"
												radius={[4, 4, 0, 0]}
											/>
											<Bar
												dataKey="churned"
												fill="hsl(0 84% 60%)"
												name="Churned"
												radius={[4, 4, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>

							<div className="grid gap-6 lg:grid-cols-2">
								<Card>
									<CardHeader>
										<CardTitle>Plan mix</CardTitle>
										<CardDescription>
											Active subscriptions by Stripe
											product ID
										</CardDescription>
									</CardHeader>
									<CardContent className="h-[280px]">
										{planPie.length === 0 ? (
											<p className="text-sm text-muted-foreground">
												No active subscription data
											</p>
										) : (
											<ResponsiveContainer
												width="100%"
												height="100%"
											>
												<PieChart>
													<Pie
														data={planPie}
														dataKey="value"
														nameKey="name"
														cx="50%"
														cy="50%"
														outerRadius={100}
														label
													>
														{planPie.map(
															(slice, i) => (
																<Cell
																	key={
																		slice.productId
																	}
																	fill={
																		CHART_COLORS[
																			i %
																				CHART_COLORS.length
																		]
																	}
																/>
															),
														)}
													</Pie>
													<Tooltip />
												</PieChart>
											</ResponsiveContainer>
										)}
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>
											Affiliate vs direct
										</CardTitle>
										<CardDescription>
											Active subscriptions (Rewardful
											referral ID)
										</CardDescription>
									</CardHeader>
									<CardContent className="h-[280px]">
										<ResponsiveContainer
											width="100%"
											height="100%"
										>
											<BarChart
												data={affiliateData}
												layout="vertical"
											>
												<CartesianGrid
													strokeDasharray="3 3"
													className="stroke-muted"
												/>
												<XAxis type="number" />
												<YAxis
													dataKey="name"
													type="category"
													width={120}
													tick={{ fontSize: 12 }}
												/>
												<Tooltip />
												<Bar
													dataKey="value"
													fill="hsl(var(--primary))"
													radius={[0, 4, 4, 0]}
													name="Subscriptions"
												/>
											</BarChart>
										</ResponsiveContainer>
									</CardContent>
								</Card>
							</div>
						</>
					) : null}
				</TabsContent>

				<TabsContent value="community" className="space-y-6">
					<div className="flex flex-wrap items-center gap-4">
						<span className="text-sm font-medium">Period</span>
						<Select
							value={discordRange}
							onValueChange={(v) =>
								setDiscordRange(
									v as "7d" | "30d" | "90d" | "all",
								)
							}
						>
							<SelectTrigger className="w-[140px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="7d">Last 7 days</SelectItem>
								<SelectItem value="30d">
									Last 30 days
								</SelectItem>
								<SelectItem value="90d">
									Last 90 days
								</SelectItem>
								<SelectItem value="all">All time</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{discordQuery.isLoading ? (
						<ChartSkeleton />
					) : discordQuery.data ? (
						<>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Connected members
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-bold">
											{
												discordQuery.data.overview
													.totalConnections
											}
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											New connections
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-bold">
											{
												discordQuery.data.overview
													.newConnections
											}
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Disconnections
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-bold">
											{
												discordQuery.data.overview
													.disconnections
											}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											In selected period
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm font-medium text-muted-foreground">
											Spouse / add-on accounts
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-bold">
											{
												discordQuery.data.overview
													.spouseAccounts
											}
										</p>
									</CardContent>
								</Card>
							</div>

							<Card>
								<CardHeader>
									<CardTitle>
										Discord connections (30 days)
									</CardTitle>
									<CardDescription>
										Users who connected, by day (UTC)
									</CardDescription>
								</CardHeader>
								<CardContent className="h-[280px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<BarChart
											data={
												discordQuery.data.connectsByDay
											}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted"
											/>
											<XAxis
												dataKey="date"
												tick={{ fontSize: 10 }}
											/>
											<YAxis tick={{ fontSize: 12 }} />
											<Tooltip />
											<Bar
												dataKey="count"
												fill="hsl(199 89% 48%)"
												name="Connections"
												radius={[4, 4, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>

							<div className="grid gap-6 lg:grid-cols-2">
								<Card>
									<CardHeader>
										<CardTitle>Role distribution</CardTitle>
										<CardDescription>
											Connected users by Discord role key
										</CardDescription>
									</CardHeader>
									<CardContent className="h-[260px]">
										<ResponsiveContainer
											width="100%"
											height="100%"
										>
											<BarChart
												data={
													discordQuery.data
														.roleDistribution
												}
											>
												<CartesianGrid
													strokeDasharray="3 3"
													className="stroke-muted"
												/>
												<XAxis
													dataKey="roleKey"
													tick={{ fontSize: 10 }}
													interval={0}
													angle={-20}
													textAnchor="end"
													height={60}
												/>
												<YAxis
													tick={{ fontSize: 12 }}
												/>
												<Tooltip />
												<Bar
													dataKey="count"
													fill="hsl(var(--primary))"
													radius={[4, 4, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									</CardContent>
								</Card>

								<Card>
									<CardHeader>
										<CardTitle>Time to connect</CardTitle>
										<CardDescription>
											Days from signup to Discord OAuth
											(connected users)
										</CardDescription>
									</CardHeader>
									<CardContent className="h-[260px]">
										<ResponsiveContainer
											width="100%"
											height="100%"
										>
											<BarChart
												data={
													discordQuery.data
														.daysToConnectHistogram
												}
											>
												<CartesianGrid
													strokeDasharray="3 3"
													className="stroke-muted"
												/>
												<XAxis
													dataKey="label"
													tick={{ fontSize: 11 }}
												/>
												<YAxis
													tick={{ fontSize: 12 }}
												/>
												<Tooltip />
												<Bar
													dataKey="count"
													fill="hsl(280 65% 60%)"
													name="Users"
													radius={[4, 4, 0, 0]}
												/>
											</BarChart>
										</ResponsiveContainer>
									</CardContent>
								</Card>
							</div>
						</>
					) : null}
				</TabsContent>

				<TabsContent value="product" className="space-y-4">
					{dashboardEmbedUrl ? (
						<Card>
							<CardHeader>
								<CardTitle>PostHog dashboard</CardTitle>
								<CardDescription>
									Embedded from your PostHog project
								</CardDescription>
							</CardHeader>
							<CardContent className="p-0">
								<iframe
									title="PostHog analytics"
									src={dashboardEmbedUrl}
									className="w-full min-h-[720px] rounded-b-lg border-0"
								/>
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardHeader>
								<CardTitle>Product usage</CardTitle>
								<CardDescription>
									PostHog is collecting events when visitors
									accept analytics cookies and{" "}
									<code className="text-xs bg-muted px-1 rounded">
										NEXT_PUBLIC_POSTHOG_KEY
									</code>{" "}
									is set.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3 text-sm text-muted-foreground">
								<p>
									After Phase 5, add funnel and trend insights
									here. For now, open PostHog → Live events to
									verify traffic.
								</p>
								<p>
									Optional: set{" "}
									<code className="text-xs bg-muted px-1 rounded">
										POSTHOG_DASHBOARD_EMBED_URL
									</code>{" "}
									(or{" "}
									<code className="text-xs bg-muted px-1 rounded">
										NEXT_PUBLIC_POSTHOG_DASHBOARD_EMBED_URL
									</code>
									) to embed a shared dashboard.
								</p>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				<TabsContent value="lifecycle" className="space-y-6">
					{lifecycleQuery.isLoading ? (
						<ChartSkeleton />
					) : lifecycleQuery.data ? (
						<>
							<div className="grid gap-4 sm:grid-cols-3">
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm text-muted-foreground">
											Signups
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-3xl font-bold">
											{
												lifecycleQuery.data.signupFunnel
													.signedUp
											}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											All non-deleted users
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm text-muted-foreground">
											With subscription
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-3xl font-bold">
											{
												lifecycleQuery.data.signupFunnel
													.subscribed
											}
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-sm text-muted-foreground">
											Discord connected
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-3xl font-bold">
											{
												lifecycleQuery.data.signupFunnel
													.discordConnected
											}
										</p>
									</CardContent>
								</Card>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								<Card>
									<CardHeader>
										<CardTitle>
											Median days to first subscription
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-semibold">
											{lifecycleQuery.data
												.medianDaysToFirstPurchase !=
											null
												? `${lifecycleQuery.data.medianDaysToFirstPurchase} d`
												: "—"}
										</p>
									</CardContent>
								</Card>
								<Card>
									<CardHeader>
										<CardTitle>
											Median days to Discord
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="text-2xl font-semibold">
											{lifecycleQuery.data
												.medianDaysToDiscordConnect !=
											null
												? `${lifecycleQuery.data.medianDaysToDiscordConnect} d`
												: "—"}
										</p>
									</CardContent>
								</Card>
							</div>

							<Card>
								<CardHeader>
									<CardTitle>Signups by month</CardTitle>
								</CardHeader>
								<CardContent className="h-[280px]">
									<ResponsiveContainer
										width="100%"
										height="100%"
									>
										<BarChart
											data={
												lifecycleQuery.data
													.signupsByMonth
											}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												className="stroke-muted"
											/>
											<XAxis
												dataKey="month"
												tick={{ fontSize: 12 }}
											/>
											<YAxis tick={{ fontSize: 12 }} />
											<Tooltip />
											<Bar
												dataKey="count"
												fill="hsl(var(--primary))"
												name="Signups"
												radius={[4, 4, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Cohort retention</CardTitle>
									<CardDescription>
										Share of signups in each month who still
										have an active subscription today
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Cohort</TableHead>
												<TableHead className="text-right">
													Signups
												</TableHead>
												<TableHead className="text-right">
													Active sub now
												</TableHead>
												<TableHead className="text-right">
													%
												</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{lifecycleQuery.data.cohortRetention.map(
												(row) => (
													<TableRow
														key={row.cohortMonth}
													>
														<TableCell>
															{row.cohortMonth}
														</TableCell>
														<TableCell className="text-right">
															{row.signups}
														</TableCell>
														<TableCell className="text-right">
															{row.withActiveSub}
														</TableCell>
														<TableCell className="text-right">
															{row.retentionPercent !=
															null
																? `${row.retentionPercent}%`
																: "—"}
														</TableCell>
													</TableRow>
												),
											)}
										</TableBody>
									</Table>
								</CardContent>
							</Card>
						</>
					) : null}
				</TabsContent>
			</Tabs>
		</div>
	);
}
