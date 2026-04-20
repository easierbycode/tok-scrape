"use client";

import type { SubscriptionWithUser } from "@repo/api/modules/admin/types";
import {
	formatPlanIdForAdminLabel,
	getSellableSubscriptionPlanPrices,
} from "@saas/admin/lib/sellable-subscription-plans";
import { formatCurrency, formatDate } from "@saas/admin/lib/subscription-utils";
import { useMarketingPricing } from "@saas/payments/hooks/marketing-pricing";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Separator } from "@ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Textarea } from "@ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@ui/components/tooltip";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	Calendar,
	CheckCircle2,
	Copy,
	CreditCard,
	Tag,
	XCircle,
} from "@/modules/ui/icons";

interface ManageActiveSubscriptionDialogProps {
	subscription: SubscriptionWithUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function ManageActiveSubscriptionDialog({
	subscription,
	open,
	onOpenChange,
	onSuccess,
}: ManageActiveSubscriptionDialogProps) {
	const queryClient = useQueryClient();

	const applyCouponMutation = useMutation(
		orpc.admin.subscriptions.applyCoupon.mutationOptions(),
	);
	const applyCreditMutation = useMutation(
		orpc.admin.subscriptions.applyCredit.mutationOptions(),
	);
	const changePlanMutation = useMutation(
		orpc.admin.subscriptions.changePlan.mutationOptions(),
	);
	const cancelMutation = useMutation(
		orpc.admin.subscriptions.cancel.mutationOptions(),
	);

	// Tab 1: Apply Coupon
	const [selectedCoupon, setSelectedCoupon] = useState("");
	const [customCouponCode, setCustomCouponCode] = useState("");
	const [couponReason, setCouponReason] = useState("");

	// Tab 2: Apply Credit
	const [creditAmount, setCreditAmount] = useState("");
	const [creditReason, setCreditReason] = useState("");

	// Tab 3: Change Plan
	const [newPlan, setNewPlan] = useState("");
	const [applyTiming, setApplyTiming] = useState<
		"immediate" | "next_renewal"
	>("immediate");
	const [planChangeReason, setPlanChangeReason] = useState("");

	// Tab 4: Cancel
	const [cancelType, setCancelType] = useState<"end_of_period" | "immediate">(
		"end_of_period",
	);
	const [cancelReason, setCancelReason] = useState("");

	// Fetch available coupons from Stripe
	const { data: couponsData, isLoading: isLoadingCoupons } = useQuery(
		orpc.admin.subscriptions.listCoupons.queryOptions(),
	);

	const availableCoupons = couponsData?.coupons || [];

	const handleApplyCoupon = async () => {
		if (!subscription) {
			return;
		}

		const couponToApply = customCouponCode || selectedCoupon;
		if (!couponToApply || couponReason.length < 10) {
			toast.error(
				"Please provide a coupon code and reason (min 10 characters)",
			);
			return;
		}

		const toastId = toast.loading("Applying coupon...");
		try {
			await applyCouponMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				couponId: couponToApply,
				reason: couponReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success("Coupon applied successfully", { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to apply coupon: ${error.message}`, {
				id: toastId,
			});
		}
	};

	const handleApplyCredit = async () => {
		if (!subscription) {
			return;
		}

		const amount = Number.parseFloat(creditAmount);
		if (!amount || amount < 1 || creditReason.length < 10) {
			toast.error(
				"Please provide valid amount ($1+) and reason (min 10 characters)",
			);
			return;
		}

		const toastId = toast.loading("Applying credit...");
		try {
			await applyCreditMutation.mutateAsync({
				customerId: subscription.customerId,
				amount: amount * 100, // Convert to cents
				reason: creditReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success(`$${amount} credit applied successfully`, {
				id: toastId,
			});
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to apply credit: ${error.message}`, {
				id: toastId,
			});
		}
	};

	const handleChangePlan = async () => {
		if (!subscription) {
			return;
		}

		if (!newPlan || planChangeReason.length < 10) {
			toast.error(
				"Please select a plan and provide reason (min 10 characters)",
			);
			return;
		}

		const toastId = toast.loading("Changing plan...");
		try {
			await changePlanMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				newPriceId: newPlan,
				prorate: applyTiming === "immediate",
				reason: planChangeReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success("Plan changed successfully", { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to change plan: ${error.message}`, {
				id: toastId,
			});
		}
	};

	const handleCancelSubscription = async () => {
		if (!subscription) {
			return;
		}

		if (cancelReason.length < 10) {
			toast.error("Please provide reason (min 10 characters)");
			return;
		}

		const toastId = toast.loading("Canceling subscription...");
		try {
			await cancelMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				immediate: cancelType === "immediate",
				reason: cancelReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success(
				cancelType === "end_of_period"
					? "Subscription will cancel at period end"
					: "Subscription cancelled immediately",
				{ id: toastId },
			);
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to cancel subscription: ${error.message}`, {
				id: toastId,
			});
		}
	};

	const { planByPriceId } = useMarketingPricing();

	const sellablePlans = useMemo(
		() => getSellableSubscriptionPlanPrices(),
		[],
	);

	function priceLabelForPriceId(priceId: string): string {
		const row = planByPriceId.get(priceId);
		return row
			? `${row.price}${row.period ? ` ${row.period}` : ""}`
			: "N/A";
	}

	if (!subscription) {
		return null;
	}

	const copySubscriptionId = () => {
		navigator.clipboard.writeText(subscription.subscriptionId);
		toast.success("Subscription ID copied to clipboard");
	};

	// Determine plan display name with billing cycle
	const planDisplayName =
		subscription.plan.includes("Monthly") ||
		subscription.plan.includes("Yearly")
			? subscription.plan
			: subscription.billingCycle === "yearly"
				? `${subscription.plan} Yearly`
				: subscription.billingCycle === "monthly"
					? `${subscription.plan} Monthly`
					: subscription.plan;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="font-serif font-semibold">
						Manage Active Subscription
					</DialogTitle>
				</DialogHeader>

				{/* User Info */}
				<div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
					<UserAvatar
						className="h-12 w-12"
						name={subscription.userName ?? subscription.userEmail}
						avatarUrl={subscription.userAvatar}
					/>
					<div>
						<p className="font-medium">{subscription.userName}</p>
						<p className="text-sm text-muted-foreground">
							{subscription.userEmail}
						</p>
					</div>
					<Badge className="ml-auto border-muted-foreground/30">
						{planDisplayName}
					</Badge>
				</div>

				{/* Subscription Details */}
				<div className="rounded-lg border border-border bg-card p-4 space-y-3">
					<h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
						<CreditCard className="h-4 w-4" />
						Subscription Details
					</h4>

					<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm tabular-nums">
						{/* Amount */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Amount
							</span>
							<span className="font-medium">
								{formatCurrency(subscription.amount)}
								{subscription.billingCycle === "yearly"
									? "/yr"
									: "/mo"}
							</span>
						</div>

						{/* Status */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Status
							</span>
							<span className="font-medium flex items-center gap-1">
								<span className="h-2 w-2 rounded-full bg-green-500" />
								{subscription.status.charAt(0).toUpperCase() +
									subscription.status.slice(1)}
							</span>
						</div>

						{/* Coupon */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Coupon
							</span>
							{subscription.couponCode ? (
								<span className="font-medium flex items-center gap-1 text-green-600">
									<Tag className="h-3 w-3" />
									{subscription.couponName ||
										subscription.couponCode}
								</span>
							) : (
								<span className="text-muted-foreground">
									None
								</span>
							)}
						</div>

						{/* Discord */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Discord
							</span>
							<span className="font-medium flex items-center gap-1">
								{subscription.discordConnected ? (
									<>
										<CheckCircle2 className="h-3 w-3 text-green-500" />
										<span className="text-green-600">
											Connected
										</span>
									</>
								) : (
									<>
										<XCircle className="h-3 w-3 text-muted-foreground" />
										<span className="text-muted-foreground">
											Not connected
										</span>
									</>
								)}
							</span>
						</div>

						{/* Next Billing */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Next Billing
							</span>
							<span className="font-medium flex items-center gap-1">
								<Calendar className="h-3 w-3 text-muted-foreground" />
								{subscription.nextBilling
									? formatDate(subscription.nextBilling)
									: "N/A"}
							</span>
						</div>

						{/* Started */}
						<div className="flex justify-between">
							<span className="text-muted-foreground">
								Started
							</span>
							<span className="font-medium">
								{subscription.startedAt
									? formatDate(subscription.startedAt)
									: "N/A"}
							</span>
						</div>
					</div>

					{/* Subscription ID */}
					<div className="flex items-center justify-between pt-2 border-t border-border">
						<span className="text-xs text-muted-foreground">
							Subscription ID
						</span>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									onClick={copySubscriptionId}
									className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
								>
									{subscription.subscriptionId.substring(
										0,
										20,
									)}
									...
									<Copy className="h-3 w-3" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Click to copy full ID</p>
							</TooltipContent>
						</Tooltip>
					</div>
				</div>

				<Separator />

				<Tabs defaultValue="coupon" className="w-full">
					<TabsList className="grid grid-cols-4 w-full">
						<TabsTrigger value="coupon">Apply Coupon</TabsTrigger>
						<TabsTrigger value="credit">Apply Credit</TabsTrigger>
						<TabsTrigger value="plan">Change Plan</TabsTrigger>
						<TabsTrigger value="cancel">Cancel</TabsTrigger>
					</TabsList>

					<TabsContent value="coupon" className="space-y-4">
						<div className="space-y-2">
							<Label>Select Coupon</Label>
							<Select
								value={selectedCoupon}
								onValueChange={setSelectedCoupon}
								disabled={isLoadingCoupons}
							>
								<SelectTrigger>
									<SelectValue
										placeholder={
											isLoadingCoupons
												? "Loading coupons..."
												: "Choose a coupon"
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{availableCoupons.length === 0 &&
									!isLoadingCoupons ? (
										<SelectItem value="none" disabled>
											No coupons available
										</SelectItem>
									) : (
										availableCoupons.map((coupon) => (
											<SelectItem
												key={coupon.id}
												value={coupon.id}
											>
												{coupon.name} -{" "}
												{coupon.discount}
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
							{!isLoadingCoupons &&
								availableCoupons.length === 0 && (
									<p className="text-xs text-muted-foreground">
										No active coupons found in Stripe.
										Create coupons in your{" "}
										<a
											href="https://dashboard.stripe.com/coupons"
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary underline hover:no-underline"
										>
											Stripe dashboard
										</a>
										.
									</p>
								)}
						</div>

						<div className="space-y-2">
							<Label>Or Enter Custom Coupon Code</Label>
							<Input
								placeholder="Enter coupon code"
								value={customCouponCode}
								onChange={(e) =>
									setCustomCouponCode(e.target.value)
								}
							/>
						</div>

						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you applying this coupon?"
								value={couponReason}
								onChange={(e) =>
									setCouponReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button onClick={handleApplyCoupon} className="w-full">
							Apply Coupon
						</Button>
					</TabsContent>

					<TabsContent value="credit" className="space-y-4">
						<div className="space-y-2">
							<Label>Credit Amount ($)</Label>
							<Input
								type="number"
								placeholder="0.00"
								value={creditAmount}
								onChange={(e) =>
									setCreditAmount(e.target.value)
								}
								min="1"
								step="0.01"
							/>
						</div>

						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you applying this credit?"
								value={creditReason}
								onChange={(e) =>
									setCreditReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button onClick={handleApplyCredit} className="w-full">
							Apply Credit
						</Button>
					</TabsContent>

					<TabsContent value="plan" className="space-y-4">
						<div className="space-y-2">
							<Label>New Plan</Label>
							<Select value={newPlan} onValueChange={setNewPlan}>
								<SelectTrigger>
									<SelectValue placeholder="Select plan" />
								</SelectTrigger>
								<SelectContent>
									{sellablePlans.map(
										({ planId, priceId }) => (
											<SelectItem
												key={priceId}
												value={priceId}
											>
												{formatPlanIdForAdminLabel(
													planId,
												)}{" "}
												—{" "}
												{priceLabelForPriceId(priceId)}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Apply Timing</Label>
							<Select
								value={applyTiming}
								onValueChange={(v) => setApplyTiming(v as any)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="immediate">
										Immediate (prorated)
									</SelectItem>
									<SelectItem value="next_renewal">
										Next renewal
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you changing this plan?"
								value={planChangeReason}
								onChange={(e) =>
									setPlanChangeReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button onClick={handleChangePlan} className="w-full">
							Change Plan
						</Button>
					</TabsContent>

					<TabsContent value="cancel" className="space-y-4">
						<div className="space-y-2">
							<Label>Cancel Type</Label>
							<Select
								value={cancelType}
								onValueChange={(v) => setCancelType(v as any)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="end_of_period">
										End of period (user keeps access)
									</SelectItem>
									<SelectItem value="immediate">
										Immediate (access terminated)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you canceling this subscription?"
								value={cancelReason}
								onChange={(e) =>
									setCancelReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button
							onClick={handleCancelSubscription}
							variant="error"
							className="w-full"
						>
							Cancel Subscription
						</Button>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
