import { PricingCards } from "@marketing/home/components/v0/pricing-cards";
import { config } from "@repo/config";
import { db } from "@repo/database";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { getOrganizationList, getSession } from "@saas/auth/lib/server";
import { getPurchases } from "@saas/payments/lib/server";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { attemptAsync } from "es-toolkit";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("choosePlan.title"),
	};
}

export default async function ChoosePlanPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	let _organizationId: string | undefined;
	if (config.organizations.enable && config.organizations.enableBilling) {
		const organization = (await getOrganizationList()).at(0);

		if (!organization) {
			redirect("/new-organization");
		}

		_organizationId = organization.id;
	}

	const [error, purchases] = await attemptAsync(() => getPurchases());

	if (error || !purchases) {
		throw new Error("Failed to fetch purchases");
	}

	const { activePlan } = createPurchasesHelper(purchases);

	const activePlanConfig = activePlan
		? config.payments.plans[
				activePlan.id as keyof typeof config.payments.plans
			]
		: null;
	const isFreePlanOnly =
		activePlanConfig &&
		"isFree" in activePlanConfig &&
		activePlanConfig.isFree;

	if (activePlan && !isFreePlanOnly) {
		redirect("/app");
	}

	const [dbPlans, contentRow] = await Promise.all([
		db.marketingPricingPlan.findMany({
			where: { published: true },
			orderBy: { order: "asc" },
		}),
		db.marketingContent.findUnique({
			where: { id: "singleton" },
			select: {
				pricingHeadline: true,
				pricingSubheadline: true,
				pricingBadgeText: true,
			},
		}),
	]);

	const plans = dbPlans.map((p) => ({
		name: p.name,
		price: p.price,
		period: p.period,
		subtitle: p.subtitle,
		description: p.description,
		features: p.features,
		ctaText: p.ctaText,
		popular: p.popular,
		badge: p.badge,
		checkoutUrl: p.checkoutUrl,
		stripePriceId: p.stripePriceId ?? null,
		planType: p.planType,
		icon: p.icon,
		allowPromoCodes: p.allowPromoCodes,
		inheritsFrom: p.inheritsFrom,
		compareAtPrice: p.compareAtPrice,
		trustText: p.trustText,
	}));

	return (
		<AuthWrapper contentClass="max-w-5xl">
			{plans.length === 0 ? (
				<div className="py-24 text-center text-muted-foreground">
					No plans are available right now. Please check back soon.
				</div>
			) : (
				<PricingCards
					plans={plans}
					badgeText={contentRow?.pricingBadgeText ?? "Simple Pricing"}
					headline={contentRow?.pricingHeadline ?? "Choose Your Plan"}
					subheadline={
						contentRow?.pricingSubheadline ??
						"Get instant access to live training, the private community, and everything we have to offer."
					}
				/>
			)}
		</AuthWrapper>
	);
}
