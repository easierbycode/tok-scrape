"use client";

import { logger } from "@repo/logs";
import { useMarketingPricing } from "@saas/payments/hooks/marketing-pricing";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { CheckIcon } from "@/modules/ui/icons";

export function ChangePlan({
	organizationId: _organizationId,
	userId: _userId,
	activePlanId: _activePlanId,
}: {
	organizationId?: string;
	userId?: string;
	activePlanId?: string;
}) {
	const t = useTranslations();
	const [loading, setLoading] = useState(false);
	const { planData } = usePlanData();
	const { activePlan } = usePurchases();
	const { getDisplayPrice } = useMarketingPricing();

	const createCustomerPortalMutation = useMutation(
		orpc.payments.createCustomerPortalLink.mutationOptions(),
	);

	if (!activePlan?.purchaseId || activePlan.isManualOverride) {
		return null;
	}

	const configPrice =
		activePlan.price?.type === "recurring" ? activePlan.price : undefined;

	if (!configPrice) {
		return null;
	}

	const priceDisplay = getDisplayPrice(configPrice.productId);

	if (!priceDisplay) {
		return null;
	}

	const { title, description, features } = planData[activePlan.id];

	const openBillingPortal = async () => {
		setLoading(true);
		try {
			const { customerPortalLink } =
				await createCustomerPortalMutation.mutateAsync({
					purchaseId: activePlan.purchaseId,
					redirectUrl: window.location.href,
				});
			capturePostHogProductEvent(
				POSTHOG_PRODUCT_EVENTS.BILLING_PORTAL_OPENED,
				{
					source: "change_plan",
				},
			);
			window.location.href = customerPortalLink;
		} catch (error) {
			logger.error("Failed to open billing portal", { error });
			toast.error(
				t(
					"settings.billing.createCustomerPortal.notifications.error.title",
				),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<SettingsItem
			title={t("settings.billing.changePlan.title")}
			description={t("settings.billing.changePlan.description")}
		>
			<div className="rounded-lg border-2 border-primary p-6 shadow-brand-glow md:shadow-brand-glow-desktop">
				<div className="flex h-full flex-col justify-between gap-4">
					<div>
						<h3 className="my-0 font-serif font-bold text-2xl text-primary">
							{title}
						</h3>
						{description && (
							<div className="prose mt-2 text-muted-foreground text-sm">
								{description}
							</div>
						)}

						{!!features?.length && (
							<ul className="mt-4 grid list-none gap-2 text-sm">
								{features.map((feature, key) => (
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
					</div>

					<div>
						<strong className="block font-medium text-2xl lg:text-3xl">
							{priceDisplay}
						</strong>

						<Button
							onClick={() => void openBillingPortal()}
							loading={loading}
							className="mt-4 w-full"
							size="lg"
						>
							{t("settings.billing.changePlan.button")}
						</Button>
					</div>
				</div>
			</div>
		</SettingsItem>
	);
}
