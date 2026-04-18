"use client";

import { AnimatedNumber } from "@shared/components/AnimatedNumber";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import {
	ChevronRight,
	DollarSign,
	TrendingUp,
	Users,
	Wallet,
} from "@/modules/ui/icons";
import type {
	AffiliateData,
	EarningsBreakdown,
	ReferralPipeline,
} from "../lib/types";

interface OverviewTabProps {
	stats: AffiliateData;
	earnings: EarningsBreakdown;
	pipeline: ReferralPipeline;
}

export function OverviewTab({ stats, earnings, pipeline }: OverviewTabProps) {
	return (
		<div className="space-y-6">
			{/* Stats Cards Grid */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium">
							Total Earnings
						</CardTitle>
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
							<DollarSign className="h-4 w-4 text-primary" />
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<AnimatedNumber
							value={stats.totalEarnings}
							format="currency"
							className="text-2xl font-bold text-primary"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							$
							{earnings.due.toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}{" "}
							available
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium">
							Total Referrals
						</CardTitle>
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
							<Users className="h-4 w-4 text-blue-500" />
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<AnimatedNumber
							value={stats.totalReferrals}
							className="text-2xl font-bold"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{stats.totalConversions} conversions
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium">
							Total Clicks
						</CardTitle>
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
							<TrendingUp className="h-4 w-4 text-purple-500" />
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<AnimatedNumber
							value={stats.totalClicks}
							className="text-2xl font-bold"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{stats.totalLeads} leads
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium">
							Conversion Rate
						</CardTitle>
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
							<Wallet className="h-4 w-4 text-success" />
						</div>
					</CardHeader>
					<CardContent className="pt-0">
						<AnimatedNumber
							value={stats.conversionRate * 100}
							format="percent"
							className="text-2xl font-bold text-success"
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Lead to customer
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Referral Pipeline - Funnel Visualization */}
			<Card>
				<CardHeader>
					<CardTitle>Referral Pipeline</CardTitle>
					<CardDescription>
						Track your audience journey from click to conversion
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
						{/* Stage 1: Visitors */}
						<div className="flex-1 w-full md:max-w-[240px]">
							<div className="bg-muted/50 border border-border rounded-xl p-6 text-center">
								<div className="text-sm text-muted-foreground mb-2">
									Visitors
								</div>
								<div className="text-3xl md:text-4xl font-bold">
									{pipeline.visitors}
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Clicked your link
								</div>
							</div>
						</div>

						{/* Arrow 1 with label */}
						<div className="flex flex-col md:flex-row items-center gap-2 shrink-0">
							<div className="flex flex-col md:flex-row items-center">
								<ChevronRight className="w-6 h-6 text-muted-foreground rotate-90 md:rotate-0" />
							</div>
							<div className="text-xs text-muted-foreground text-center md:text-left whitespace-nowrap">
								{pipeline.signupRate}% signup
							</div>
						</div>

						{/* Stage 2: Leads */}
						<div className="flex-1 w-full md:max-w-[240px]">
							<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 text-center">
								<div className="text-sm text-yellow-600 dark:text-yellow-500 mb-2 font-medium">
									Leads
								</div>
								<div className="text-3xl md:text-4xl font-bold text-yellow-600 dark:text-yellow-500">
									{pipeline.leads}
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Signed up
								</div>
							</div>
						</div>

						{/* Arrow 2 with label */}
						<div className="flex flex-col md:flex-row items-center gap-2 shrink-0">
							<div className="flex flex-col md:flex-row items-center">
								<ChevronRight className="w-6 h-6 text-yellow-500/70 rotate-90 md:rotate-0" />
							</div>
							<div className="text-xs text-yellow-600/80 dark:text-yellow-500/80 text-center md:text-left whitespace-nowrap">
								{pipeline.conversionRate}% convert
							</div>
						</div>

						{/* Stage 3: Conversions */}
						<div className="flex-1 w-full md:max-w-[240px]">
							<div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center">
								<div className="text-sm text-green-600 dark:text-green-500 mb-2 font-medium">
									Conversions
								</div>
								<div className="text-3xl md:text-4xl font-bold text-green-600 dark:text-green-500">
									{pipeline.conversions}
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									Paid customers
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
