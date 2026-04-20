"use client";

import { SubscriptionStatusBadge } from "@saas/admin/component/StatusBadges";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Separator } from "@ui/components/separator";
import { toast } from "sonner";
// biome-ignore lint/suspicious/noShadowRestrictedNames: Infinity is a re-exported icon component alias from @/modules/ui/icons
import { Copy, CreditCard, ExternalLink, Infinity } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
	subscriptionStatus:
		| "active"
		| "cancelled"
		| "grace_period"
		| "scheduled_cancel"
		| "none"
		| "manual"
		| "trial"
		| "lifetime";
	planLabel?: string;
	subscriptionDetails?: {
		customerId: string;
		subscriptionId: string | null;
		productId: string;
		status: string | null;
		amount?: number;
		billingInterval?: string;
		currentPeriodEnd?: string;
		cancelAtPeriodEnd?: boolean;
		trialEnd?: string;
		cancelledAt?: string;
		createdAt: string;
	} | null;
}

interface ViewSubscriptionDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function formatDate(dateString?: string) {
	if (!dateString) {
		return "N/A";
	}
	return new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getBillingCycle(details?: User["subscriptionDetails"] | null): string {
	if (!details) {
		return "N/A";
	}
	if (details.billingInterval === "year") {
		return "Yearly";
	}
	if (details.billingInterval === "month") {
		return "Monthly";
	}
	if (details.billingInterval === "day") {
		return "Daily";
	}
	if (details.billingInterval === "week") {
		return "Weekly";
	}
	return "N/A";
}

function formatAmount(
	amount?: number,
	billingInterval?: string,
): string | null {
	if (amount === undefined || amount === null) {
		return null;
	}
	const dollars = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
	if (billingInterval === "year") {
		return `${dollars}/yr`;
	}
	if (billingInterval === "month") {
		return `${dollars}/mo`;
	}
	if (billingInterval === "day") {
		return `${dollars}/day`;
	}
	if (billingInterval === "week") {
		return `${dollars}/wk`;
	}
	return dollars;
}

export function ViewSubscriptionDialog({
	user,
	open,
	onOpenChange,
}: ViewSubscriptionDialogProps) {
	if (!user) {
		return null;
	}

	const details = user.subscriptionDetails;
	const isLifetime = user.subscriptionStatus === "lifetime";
	const isManual = user.subscriptionStatus === "manual";
	const isRecurring = !isLifetime && !isManual && !!details?.subscriptionId;

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	};

	const openInStripe = () => {
		if (details?.customerId) {
			window.open(
				`https://dashboard.stripe.com/customers/${details.customerId}`,
				"_blank",
			);
		} else {
			toast.info("No Stripe customer ID available");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CreditCard className="h-5 w-5 text-primary" />
						Subscription Details
					</DialogTitle>
					<DialogDescription>
						Viewing subscription information for {user.name}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{details ? (
						<>
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-sm font-medium">
											Current Plan
										</p>
										<p className="text-2xl font-bold">
											{user.planLabel ?? "Subscription"}
										</p>
									</div>
									<SubscriptionStatusBadge
										status={user.subscriptionStatus}
									/>
								</div>

								{isLifetime && (
									<div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 flex items-center gap-2">
										<Infinity className="h-4 w-4 text-violet-500" />
										<div>
											<p className="text-sm font-medium text-violet-600 dark:text-violet-400">
												Lifetime Access
											</p>
											<p className="text-xs text-muted-foreground">
												One-time purchase — no renewal
												or billing cycle
											</p>
										</div>
									</div>
								)}

								{isManual && (
									<div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
										<p className="text-sm font-medium text-blue-600 dark:text-blue-400">
											Manually Granted Access
										</p>
										<p className="text-xs text-muted-foreground">
											This access was granted by an admin
											— no Stripe subscription
										</p>
									</div>
								)}

								{isRecurring && (
									<div className="grid grid-cols-2 gap-4">
										{formatAmount(
											details.amount,
											details.billingInterval,
										) && (
											<div>
												<p className="text-sm text-muted-foreground">
													Amount
												</p>
												<p className="text-sm font-medium">
													{formatAmount(
														details.amount,
														details.billingInterval,
													)}
												</p>
											</div>
										)}
										<div>
											<p className="text-sm text-muted-foreground">
												Billing Cycle
											</p>
											<p className="text-sm font-medium">
												{getBillingCycle(details)}
											</p>
										</div>
										<div>
											<p className="text-sm text-muted-foreground">
												Next Renewal
											</p>
											<p className="text-sm font-medium">
												{details.cancelAtPeriodEnd
													? "Cancels at period end"
													: formatDate(
															details.currentPeriodEnd,
														)}
											</p>
										</div>
									</div>
								)}

								{!isLifetime &&
									!isManual &&
									!isRecurring &&
									details.currentPeriodEnd && (
										<div>
											<p className="text-sm text-muted-foreground">
												Period End
											</p>
											<p className="text-sm font-medium">
												{formatDate(
													details.currentPeriodEnd,
												)}
											</p>
										</div>
									)}

								<div className="text-xs text-muted-foreground">
									Created {formatDate(details.createdAt)}
								</div>

								{details.trialEnd && (
									<div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
										<p className="text-xs text-muted-foreground">
											Trial Ends
										</p>
										<p className="text-sm font-medium">
											{formatDate(details.trialEnd)}
										</p>
									</div>
								)}

								{details.cancelledAt && (
									<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
										<p className="text-xs text-muted-foreground">
											Cancelled On
										</p>
										<p className="text-sm font-medium">
											{formatDate(details.cancelledAt)}
										</p>
									</div>
								)}

								<div className="flex items-center justify-between rounded-lg bg-muted p-3">
									<div className="min-w-0 flex-1">
										<p className="text-xs text-muted-foreground">
											Stripe Customer ID
										</p>
										<p className="text-sm font-mono truncate">
											{details.customerId}
										</p>
									</div>
									<div className="flex gap-2 shrink-0">
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() =>
												copyToClipboard(
													details.customerId,
												)
											}
										>
											<Copy className="h-4 w-4" />
											<span className="sr-only">
												Copy customer ID
											</span>
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={openInStripe}
										>
											<ExternalLink className="h-4 w-4" />
											<span className="sr-only">
												View in Stripe
											</span>
										</Button>
									</div>
								</div>

								{details.subscriptionId && (
									<div className="flex items-center justify-between rounded-lg bg-muted p-3">
										<div className="min-w-0 flex-1">
											<p className="text-xs text-muted-foreground">
												Subscription ID
											</p>
											<p className="text-sm font-mono truncate">
												{details.subscriptionId}
											</p>
										</div>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 shrink-0"
											onClick={() =>
												copyToClipboard(
													details.subscriptionId!,
												)
											}
										>
											<Copy className="h-4 w-4" />
											<span className="sr-only">
												Copy subscription ID
											</span>
										</Button>
									</div>
								)}
							</div>

							<Separator />

							<div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
								<p className="font-medium mb-1">
									Transaction History:
								</p>
								<p>
									To view detailed billing history and
									invoices, click the external link icon above
									to open this customer in the Stripe
									Dashboard.
								</p>
							</div>
						</>
					) : (
						<div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
							<p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
								No Subscription Data
							</p>
							<p className="text-sm text-muted-foreground mt-1">
								This user does not have an active subscription
								or subscription details are not available.
							</p>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
