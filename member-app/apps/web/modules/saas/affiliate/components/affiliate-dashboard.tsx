"use client";

import { logger } from "@repo/logs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { useEffect, useState } from "react";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import type {
	AffiliateData,
	EarningsBreakdown,
	ReferralPipeline,
} from "../lib/types";
import { AffiliateLoading } from "./affiliate-loading";
import { ComingSoonTab } from "./coming-soon-tab";
import { EarningsTab } from "./earnings-tab";
import { LinksTab } from "./links-tab";
import { OnboardingBanner } from "./onboarding-banner";
import { OverviewTab } from "./overview-tab";
import { PayoutsTab } from "./payouts-tab";
import { ReferralsTab } from "./referrals-tab";

export function AffiliateDashboard() {
	const [isLoading, setIsLoading] = useState(true);
	const [data, setData] = useState<{
		affiliate: AffiliateData | null;
		earnings: EarningsBreakdown | null;
		pipeline: ReferralPipeline | null;
	} | null>(null);

	useEffect(() => {
		async function fetchData() {
			try {
				const status = await orpcClient.users.affiliate.status();

				if (!status.hasAffiliate) {
					setIsLoading(false);
					return;
				}

				// Map backend data to component format
				// For now, earnings and pipeline are null (will show "Coming Soon" in tabs)
				const affiliate: AffiliateData = {
					id: status.affiliate?.slug ?? "",
					customLinkSlug: status.affiliate?.slug ?? "",
					totalReferrals: 0, // TODO: Fetch from Rewardful
					totalEarnings:
						(status.affiliate?.commissionsEarned ?? 0) / 100,
					totalClicks: 0, // TODO: Fetch from Rewardful
					totalLeads: 0, // TODO: Fetch from Rewardful
					totalConversions: 0, // TODO: Fetch from Rewardful
					conversionRate: 0, // TODO: Fetch from Rewardful
					pendingEarnings: 0, // TODO: Fetch from Rewardful
					dueEarnings: 0, // TODO: Fetch from Rewardful
					paidEarnings: 0, // TODO: Fetch from Rewardful
					payoutEmail: "", // TODO: Fetch from database
					payoutMethod: "", // TODO: Fetch from database
				};

				setData({
					affiliate,
					earnings: { pending: 0, due: 0, paid: 0, total: 0 }, // TODO: Future - fetch from Rewardful
					pipeline: {
						visitors: 0,
						leads: 0,
						conversions: 0,
						signupRate: "0.0",
						conversionRate: "0.0",
					}, // TODO: Future - fetch from Rewardful
				});
			} catch (error) {
				logger.error("Failed to fetch affiliate data", { error });
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, []);

	if (isLoading) {
		return <AffiliateLoading />;
	}
	if (!data?.affiliate) {
		return null;
	}

	return (
		<div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
			{/* Onboarding Banner */}
			<OnboardingBanner />

			{/* Tabs */}
			<Tabs defaultValue="overview" className="space-y-6">
				<div className="w-full overflow-x-auto">
					<TabsList className="inline-flex w-full sm:w-auto min-w-full sm:min-w-0">
						<TabsTrigger
							value="overview"
							className="flex-1 sm:flex-initial"
						>
							Overview
						</TabsTrigger>
						<TabsTrigger
							value="links"
							className="flex-1 sm:flex-initial"
						>
							Links
						</TabsTrigger>
						<TabsTrigger
							value="earnings"
							className="flex-1 sm:flex-initial"
						>
							Earnings
						</TabsTrigger>
						<TabsTrigger
							value="referrals"
							className="flex-1 sm:flex-initial"
						>
							Referrals
						</TabsTrigger>
						<TabsTrigger
							value="payouts"
							className="flex-1 sm:flex-initial"
						>
							Payouts
						</TabsTrigger>
						<TabsTrigger
							value="coupons"
							className="flex-1 sm:flex-initial"
						>
							Coupons
						</TabsTrigger>
						<TabsTrigger
							value="resources"
							className="flex-1 sm:flex-initial"
						>
							Resources
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="overview">
					<OverviewTab
						stats={data.affiliate}
						earnings={
							data.earnings ?? {
								pending: 0,
								due: 0,
								paid: 0,
								total: 0,
							}
						}
						pipeline={
							data.pipeline ?? {
								visitors: 0,
								leads: 0,
								conversions: 0,
								signupRate: "0.0",
								conversionRate: "0.0",
							}
						}
					/>
				</TabsContent>

				<TabsContent value="links">
					<LinksTab />
				</TabsContent>

				<TabsContent value="earnings">
					<EarningsTab />
				</TabsContent>

				<TabsContent value="referrals">
					<ReferralsTab />
				</TabsContent>

				<TabsContent value="payouts">
					<PayoutsTab />
				</TabsContent>

				<TabsContent value="coupons">
					<ComingSoonTab
						title="Coupons Coming Soon"
						description="Create custom discount codes for your audience"
					/>
				</TabsContent>

				<TabsContent value="resources">
					<ComingSoonTab
						title="Resources Coming Soon"
						description="Marketing assets, templates, and guides"
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
