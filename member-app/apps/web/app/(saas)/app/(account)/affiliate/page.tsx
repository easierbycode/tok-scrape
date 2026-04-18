import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { db } from "@repo/database";
import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { AffiliateDashboard } from "@/modules/saas/affiliate/components/affiliate-dashboard";
import { AffiliateDashboardSimple } from "@/modules/saas/affiliate/components/affiliate-dashboard-simple";
import { AffiliateSignup } from "@/modules/saas/affiliate/components/affiliate-signup";

export default async function AffiliatePage() {
	const session = await getSession();
	const userId = session?.user?.id;

	const betaFeatures: string[] =
		(session?.user as { betaFeatures?: string[] } | undefined)
			?.betaFeatures ?? [];
	const hasFullDashboard = betaFeatures.includes(
		BETA_FEATURE_IDS.FULL_AFFILIATE_DASHBOARD,
	);

	const affiliate = userId
		? await db.affiliate.findUnique({ where: { userId } })
		: null;

	if (!affiliate) {
		return <AffiliateSignup />;
	}

	return (
		<>
			<PageHeader
				title="Affiliate Dashboard"
				subtitle="Track your referrals and earnings"
			/>
			<div className="py-6">
				{hasFullDashboard ? (
					<AffiliateDashboard />
				) : (
					<AffiliateDashboardSimple
						primaryLinkUrl={affiliate.primaryLinkUrl}
						visitors={affiliate.visitors}
						conversions={affiliate.conversions}
						commissionsEarned={affiliate.commissionsEarned / 100}
						commissionsPending={affiliate.commissionsPending / 100}
						commissionsPaid={affiliate.commissionsPaid / 100}
						lastSyncAt={affiliate.lastSyncAt?.toISOString() ?? null}
					/>
				)}
			</div>
		</>
	);
}
