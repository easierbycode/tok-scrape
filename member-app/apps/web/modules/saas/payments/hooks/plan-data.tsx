import type { config } from "@repo/config";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type ProductReferenceId = keyof (typeof config)["payments"]["plans"];

export function usePlanData() {
	const t = useTranslations();

	const planData: Record<
		ProductReferenceId,
		{
			title: string;
			description: ReactNode;
			features: ReactNode[];
		}
	> = {
		free: {
			title: t("pricing.products.free.title"),
			description: t("pricing.products.free.description"),
			features: [
				t("pricing.products.free.features.anotherFeature"),
				t("pricing.products.free.features.limitedSupport"),
			],
		},
		starter_monthly: {
			title: t("pricing.products.starter_monthly.title"),
			description: t("pricing.products.starter_monthly.description"),
			features: [
				t("pricing.products.starter_monthly.features.communityAccess"),
				t("pricing.products.starter_monthly.features.liveSessions"),
				t("pricing.products.starter_monthly.features.trainingLibrary"),
				t("pricing.products.starter_monthly.features.cancelAnytime"),
			],
		},
		creator_monthly: {
			title: t("pricing.products.creator_monthly.title"),
			description: t("pricing.products.creator_monthly.description"),
			features: [
				t("pricing.products.creator_monthly.features.communityAccess"),
				t("pricing.products.creator_monthly.features.liveSessions"),
				t("pricing.products.creator_monthly.features.trainingLibrary"),
				t("pricing.products.creator_monthly.features.cancelAnytime"),
			],
		},
		streamer_monthly: {
			title: t("pricing.products.streamer_monthly.title"),
			description: t("pricing.products.streamer_monthly.description"),
			features: [
				t("pricing.products.streamer_monthly.features.communityAccess"),
				t("pricing.products.streamer_monthly.features.liveSessions"),
				t("pricing.products.streamer_monthly.features.trainingLibrary"),
				t("pricing.products.streamer_monthly.features.cancelAnytime"),
			],
		},
		partner_monthly: {
			title: t("pricing.products.partner_monthly.title"),
			description: t("pricing.products.partner_monthly.description"),
			features: [
				t("pricing.products.partner_monthly.features.communityAccess"),
				t("pricing.products.partner_monthly.features.liveSessions"),
				t("pricing.products.partner_monthly.features.trainingLibrary"),
				t("pricing.products.partner_monthly.features.cancelAnytime"),
			],
		},
		pro: {
			title: t("pricing.products.pro.title"),
			description: t("pricing.products.pro.description"),
			features: [
				t("pricing.products.pro.features.communityAccess"),
				t("pricing.products.pro.features.liveSessions"),
				t("pricing.products.pro.features.trainingLibrary"),
				t("pricing.products.pro.features.affiliateProgram"),
				t("pricing.products.pro.features.prioritySupport"),
				t("pricing.products.pro.features.cancelAnytime"),
			],
		},
		test_daily: {
			title: t("pricing.products.test_daily.title"),
			description: t("pricing.products.test_daily.description"),
			features: [t("pricing.products.test_daily.features.testOnly")],
		},
		test_2day: {
			title: t("pricing.products.test_2day.title"),
			description: t("pricing.products.test_2day.description"),
			features: [t("pricing.products.test_2day.features.testOnly")],
		},
		lifetime: {
			title: t("pricing.products.lifetime.title"),
			description: t("pricing.products.lifetime.description"),
			features: [
				t("pricing.products.lifetime.features.communityAccess"),
				t("pricing.products.lifetime.features.trainingLibrary"),
			],
		},
		manual_override: {
			title: t("pricing.products.manual_override.title"),
			description: t("pricing.products.manual_override.description"),
			features: [t("pricing.products.manual_override.features.managed")],
		},
		no_active_plan: {
			title: t("pricing.products.no_active_plan.title"),
			description: t("pricing.products.no_active_plan.description"),
			features: [t("pricing.products.no_active_plan.features.contact")],
		},
	};

	return { planData };
}
