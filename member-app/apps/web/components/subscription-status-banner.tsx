"use client";

import { useUserPurchases } from "@saas/payments/hooks/purchases";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import Link from "next/link";
import { AlertTriangleIcon, CreditCardIcon } from "@/modules/ui/icons";

export function SubscriptionStatusBanner() {
	const { purchases, isPending } = useUserPurchases();

	if (isPending) {
		return null;
	}

	const activePurchase = purchases.find(
		(p) => p.status === "active" || p.status === "grace_period",
	);

	if (!activePurchase) {
		return (
			<div className="sticky top-0 z-40 w-full border-b border-primary/20 bg-primary/10 px-4 py-3">
				<Alert
					variant="primary"
					className="border-primary/20 bg-primary/10"
				>
					<CreditCardIcon className="h-4 w-4 text-primary" />
					<AlertTitle className="text-primary">
						Upgrade Required
					</AlertTitle>
					<AlertDescription className="text-primary/90">
						Subscribe to unlock full access to all content and
						features.
						<Button
							variant="primary"
							size="sm"
							className="ml-4 mt-2"
							asChild
						>
							<Link href="/choose-plan">Choose Plan</Link>
						</Button>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (activePurchase.status === "grace_period") {
		const currentPeriodEnd = activePurchase.currentPeriodEnd
			? new Date(activePurchase.currentPeriodEnd)
			: null;

		return (
			<div className="sticky top-0 z-40 w-full border-b border-warning/20 bg-warning/10 px-4 py-3">
				<Alert
					variant="error"
					className="border-warning/20 bg-warning/10"
				>
					<AlertTriangleIcon className="h-4 w-4 text-warning" />
					<AlertTitle className="text-warning">
						Payment Failed
					</AlertTitle>
					<AlertDescription className="text-warning/90">
						{currentPeriodEnd
							? `Your subscription payment failed. Update payment method by ${currentPeriodEnd.toLocaleDateString()} to continue access.`
							: "Your subscription payment failed. Please update your payment method to continue access."}
						<Button
							variant="outline"
							size="sm"
							className="ml-4 mt-2"
							asChild
						>
							<Link href="/app/settings/billing">
								Update Payment
							</Link>
						</Button>
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	return null;
}
