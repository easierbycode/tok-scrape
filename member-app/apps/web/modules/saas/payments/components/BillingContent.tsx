"use client";

import { useMarketingPricing } from "@saas/payments/hooks/marketing-pricing";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Skeleton } from "@ui/components/skeleton";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
	AlertTriangleIcon,
	BadgeCheckIcon,
	CalendarClock,
	CreditCard,
} from "@/modules/ui/icons";
import { CustomerPortalButton } from "../../settings/components/CustomerPortalButton";
import { SubscriptionStatusBadge } from "../../settings/components/SubscriptionStatusBadge";

export function BillingContent() {
	const t = useTranslations();
	const format = useFormatter();
	const { planData } = usePlanData();
	const { activePlan, purchases, isPending } = usePurchases();
	const { getDisplayPrice } = useMarketingPricing();

	const gracePurchase = purchases.find(
		(p) => p.type === "SUBSCRIPTION" && p.status === "grace_period",
	);

	const cancelledAtPeriodEndPurchase = purchases.find(
		(p) =>
			p.type === "SUBSCRIPTION" &&
			p.status === "active" &&
			p.cancelAtPeriodEnd === true,
	);

	const pendingPlanChangePurchase = purchases.find(
		(p) =>
			p.type === "SUBSCRIPTION" &&
			p.status === "active" &&
			p.pendingPlanChangeAt != null,
	);

	if (isPending) {
		return (
			<SettingsList>
				<SettingsItem title={t("settings.billing.title")}>
					<div className="rounded-lg border p-6 space-y-3">
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-10 w-32" />
						<Skeleton className="h-4 w-64" />
					</div>
				</SettingsItem>
			</SettingsList>
		);
	}

	// No active subscription
	if (!activePlan || !activePlan.purchaseId) {
		return (
			<SettingsList>
				<SettingsItem title={t("settings.billing.title")}>
					<Alert>
						<CreditCard className="h-4 w-4" />
						<AlertDescription>
							You don't have an active subscription.{" "}
							<Link
								href="/choose-plan"
								className="text-primary underline"
							>
								View pricing
							</Link>
						</AlertDescription>
					</Alert>
				</SettingsItem>
			</SettingsList>
		);
	}

	const activePlanData = planData[activePlan.id as keyof typeof planData];

	if (!activePlanData) {
		return null;
	}

	const configPrice = "price" in activePlan ? activePlan.price : null;
	const displayPrice = getDisplayPrice(configPrice?.productId);
	const isManualAccess =
		"isManualOverride" in activePlan && activePlan.isManualOverride;

	function formatBillingDate(value: Date | string | null | undefined) {
		if (!value) {
			return null;
		}
		const d = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(d.getTime())) {
			return null;
		}
		return format.dateTime(d, {
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	const graceEndLabel = gracePurchase
		? formatBillingDate(gracePurchase.currentPeriodEnd)
		: null;

	const accessEndLabel = cancelledAtPeriodEndPurchase
		? formatBillingDate(cancelledAtPeriodEndPurchase.currentPeriodEnd)
		: null;

	return (
		<SettingsList>
			<SettingsItem title={t("settings.billing.activePlan.title")}>
				<div className="rounded-lg border p-6 shadow-flat">
					{gracePurchase && (
						<Alert variant="warning" className="mb-4">
							<AlertTriangleIcon className="h-4 w-4" />
							<AlertTitle>
								Payment issue — grace period active
							</AlertTitle>
							<AlertDescription>
								<p>
									Your recent payment could not be processed.
									You still have temporary access. Update your
									payment method
									{graceEndLabel
										? ` by ${graceEndLabel}`
										: ""}{" "}
									to keep your subscription and Discord
									membership.
								</p>
								{!isManualAccess && (
									<p className="mt-2 text-muted-foreground">
										Use <strong>Manage billing</strong>{" "}
										below to update your card or payment
										details.
									</p>
								)}
							</AlertDescription>
						</Alert>
					)}

					{cancelledAtPeriodEndPurchase && (
						<Alert variant="warning" className="mb-4">
							<AlertTitle>Subscription cancelled</AlertTitle>
							<AlertDescription>
								<p>
									You have cancelled your subscription. Your
									access continues until{" "}
									{accessEndLabel ??
										"the end of your billing period"}
									. You can reactivate anytime before then.
								</p>
								{!isManualAccess && (
									<p className="mt-2 text-muted-foreground">
										Use <strong>Manage billing</strong>{" "}
										below to reactivate or change your plan.
									</p>
								)}
							</AlertDescription>
						</Alert>
					)}

					{pendingPlanChangePurchase && (
						<Alert variant="info" className="mb-4">
							<CalendarClock className="h-4 w-4" />
							<AlertTitle>Plan change scheduled</AlertTitle>
							<AlertDescription>
								<p>
									Your plan will change to{" "}
									<strong>
										{pendingPlanChangePurchase.pendingPlanName ??
											"a new plan"}
									</strong>{" "}
									on{" "}
									{formatBillingDate(
										pendingPlanChangePurchase.pendingPlanChangeAt,
									) ?? "your next billing date"}
									.
								</p>
								{!isManualAccess && (
									<p className="mt-2 text-muted-foreground">
										Use <strong>Manage billing</strong>{" "}
										below to cancel this scheduled change.
									</p>
								)}
							</AlertDescription>
						</Alert>
					)}

					<div className="flex items-start justify-between">
						<div className="flex-1">
							<div className="flex items-center gap-3">
								<BadgeCheckIcon className="size-6 text-primary" />
								<h4 className="font-serif font-bold text-xl text-primary">
									<span>{activePlanData.title}</span>
								</h4>
								{activePlan.status && (
									<SubscriptionStatusBadge
										status={activePlan.status}
									/>
								)}
							</div>

							{displayPrice && !isManualAccess && (
								<div className="mt-3">
									<strong className="block font-medium text-3xl">
										{displayPrice}
									</strong>
								</div>
							)}
						</div>
					</div>

					<div className="mt-6 border-t pt-4">
						{isManualAccess ? (
							<Alert>
								<BadgeCheckIcon className="h-4 w-4" />
								<AlertDescription>
									<strong className="block mb-1">
										Manual Access
									</strong>
									Your access is managed by an administrator.
									Contact support to make changes.
								</AlertDescription>
							</Alert>
						) : (
							<div className="flex justify-end">
								<CustomerPortalButton
									purchaseId={activePlan.purchaseId}
								/>
							</div>
						)}
					</div>
				</div>
			</SettingsItem>
		</SettingsList>
	);
}
