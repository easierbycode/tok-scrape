"use client";

import { useMarketingPricing } from "@saas/payments/hooks/marketing-pricing";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { useTranslations } from "next-intl";
import { BadgeCheckIcon, CheckIcon } from "@/modules/ui/icons";
import { CustomerPortalButton } from "../../settings/components/CustomerPortalButton";
import { SubscriptionStatusBadge } from "../../settings/components/SubscriptionStatusBadge";

export function ActivePlan({
	organizationId: _organizationId,
}: {
	organizationId?: string;
	seats?: number;
}) {
	const t = useTranslations();
	const { planData } = usePlanData();
	const { activePlan } = usePurchases();
	const { getDisplayPrice } = useMarketingPricing();

	if (!activePlan) {
		return null;
	}

	const activePlanData = planData[activePlan.id as keyof typeof planData];

	if (!activePlanData) {
		return null;
	}

	const configPrice = "price" in activePlan ? activePlan.price : null;
	const displayPrice = getDisplayPrice(configPrice?.productId);

	return (
		<SettingsItem title={t("settings.billing.activePlan.title")}>
			<div className="rounded-2xl border p-4 shadow-flat">
				<div className="">
					<div className="flex items-center gap-2">
						<BadgeCheckIcon className="size-6 text-primary" />
						<h4 className="font-serif font-bold text-lg text-primary">
							<span>{activePlanData.title}</span>
						</h4>
						{activePlan.status && (
							<SubscriptionStatusBadge
								status={activePlan.status}
							/>
						)}
					</div>

					{!!activePlanData.features?.length && (
						<ul className="mt-2 grid list-none gap-2 text-sm">
							{activePlanData.features.map((feature, key) => (
								<li
									key={key}
									className="flex items-center justify-start"
								>
									<CheckIcon className="mr-2 size-4 text-primary" />
									<span>{feature}</span>
								</li>
							))}
						</ul>
					)}

					{displayPrice && (
						<strong
							className="mt-2 block font-medium text-2xl lg:text-3xl"
							data-test="price-table-plan-price"
						>
							{displayPrice}
						</strong>
					)}
				</div>

				{"purchaseId" in activePlan && activePlan.purchaseId && (
					<div className="mt-4 flex justify-end">
						<div className="flex w-full flex-col flex-wrap gap-2 md:flex-row">
							<CustomerPortalButton
								purchaseId={activePlan.purchaseId}
							/>
						</div>
					</div>
				)}
			</div>
		</SettingsItem>
	);
}
