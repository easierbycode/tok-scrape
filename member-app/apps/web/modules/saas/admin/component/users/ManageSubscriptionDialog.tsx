"use client";

import { resolveSubscriptionProductIdFromPlanKey } from "@repo/payments/lib/helper";
import {
	formatPlanIdForAdminLabel,
	getSellableSubscriptionPlanPrices,
} from "@saas/admin/lib/sellable-subscription-plans";
import { useMarketingPricing } from "@saas/payments/hooks/marketing-pricing";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { RadioGroup, RadioGroupItem } from "@ui/components/radio-group";
import { Separator } from "@ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Textarea } from "@ui/components/textarea";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AlertCircle,
	Copy,
	DollarSign,
	ExternalLink,
	Gift,
	X,
} from "@/modules/ui/icons";

interface ManageSubscriptionDialogProps {
	user?: {
		id: string;
		name: string;
		email: string;
		subscriptionStatus: string;
		plan?: string;
		billingCycle?: "monthly" | "yearly" | null;
		amount?: number;
		nextBilling?: string | null;
		startDate?: string;
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		avatar?: string;
	};
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ManageSubscriptionDialog({
	user,
	open,
	onOpenChange,
}: ManageSubscriptionDialogProps) {
	const queryClient = useQueryClient();
	const [freeMonths, setFreeMonths] = useState<string>("1");
	const [freeMonthsReason, setFreeMonthsReason] = useState<string>("");
	const [freeMonthsError, setFreeMonthsError] = useState<string>("");

	const [newPlan, setNewPlan] = useState<string>("");
	const [applyTiming, setApplyTiming] = useState<
		"immediate" | "next_renewal"
	>("immediate");
	const [planChangeReason, setPlanChangeReason] = useState<string>("");
	const [planChangeError, setPlanChangeError] = useState<string>("");

	const [cancelType, setCancelType] = useState<"end_of_period" | "immediate">(
		"end_of_period",
	);
	const [cancelReason, setCancelReason] = useState<string>("");
	const [cancelError, setCancelError] = useState<string>("");

	const [convertReason, setConvertReason] = useState<string>("");
	const [convertError, setConvertError] = useState<string>("");
	const convertToPaidMutation = useMutation(
		orpc.admin.users.convertToPaid.mutationOptions(),
	);

	const grantFreeMonthsMutation = useMutation(
		orpc.admin.users.grantFreeMonths.mutationOptions(),
	);
	const changePlanMutation = useMutation(
		orpc.admin.users.changePlan.mutationOptions(),
	);
	const cancelSubscriptionMutation = useMutation(
		orpc.admin.users.cancelSubscription.mutationOptions(),
	);

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

	if (!user) {
		return null;
	}

	// Detect if user has manual access (no Stripe subscription)
	const isManualAccess =
		!user.stripeSubscriptionId || user.plan === "Manual Access";

	const validateReason = (reason: string): boolean => {
		return reason.trim().length >= 10;
	};

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	};

	const handleGrantFreeMonths = async () => {
		if (!validateReason(freeMonthsReason)) {
			setFreeMonthsError("Reason must be at least 10 characters");
			return;
		}

		setFreeMonthsError("");

		const toastId = toast.loading("Applying free months...");

		try {
			const _result = await grantFreeMonthsMutation.mutateAsync({
				userId: user.id,
				months: Number.parseInt(freeMonths, 10),
				reason: freeMonthsReason,
			});

			toast.success(`User will receive ${freeMonths} free month(s)`, {
				id: toastId,
			});

			// Invalidate queries
			await queryClient.invalidateQueries({
				queryKey: ["admin", "users", "list"],
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to apply free months",
				{ id: toastId },
			);
		}
	};

	const handleChangePlan = async () => {
		if (!validateReason(planChangeReason)) {
			setPlanChangeError("Reason must be at least 10 characters");
			return;
		}

		setPlanChangeError("");

		const toastId = toast.loading("Changing plan...");

		try {
			const _result = await changePlanMutation.mutateAsync({
				userId: user.id,
				newPlan,
				applyTiming,
				reason: planChangeReason,
			});

			toast.success(`Subscription updated to ${newPlan}`, {
				id: toastId,
			});

			// Invalidate queries
			await queryClient.invalidateQueries({
				queryKey: ["admin", "users", "list"],
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to change plan",
				{ id: toastId },
			);
		}
	};

	const handleCancelSubscription = async () => {
		if (!validateReason(cancelReason)) {
			setCancelError("Reason must be at least 10 characters");
			return;
		}

		setCancelError("");

		const toastId = toast.loading("Cancelling subscription...");

		try {
			const _result = await cancelSubscriptionMutation.mutateAsync({
				userId: user.id,
				cancelType,
				reason: cancelReason,
			});

			toast.success(
				cancelType === "end_of_period"
					? "User will retain access until period end"
					: "User access has been terminated",
				{ id: toastId },
			);

			// Invalidate queries
			await queryClient.invalidateQueries({
				queryKey: ["admin", "users", "list"],
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to cancel subscription",
				{ id: toastId },
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Manage Subscription</DialogTitle>
					<DialogDescription>
						View details and manage this user's active subscription
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
						<UserAvatar
							className="h-10 w-10"
							name={user.name ?? user.email}
							avatarUrl={user.avatar}
						/>
						<div className="flex-1 min-w-0">
							<p className="font-semibold text-sm">{user.name}</p>
							<p className="text-xs text-muted-foreground truncate">
								{user.email}
							</p>
						</div>
						<Badge className="bg-green-500/10 text-green-500 border-green-500/20 shrink-0">
							Active
						</Badge>
					</div>

					<Separator />

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">
								Plan
							</p>
							<p className="font-semibold text-sm">
								{user.plan || "—"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">
								Billing Cycle
							</p>
							<p className="font-semibold text-sm">
								{user.billingCycle || "monthly"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">
								Amount
							</p>
							<p className="font-semibold text-sm">
								{user.amount
									? `$${user.amount}`
									: isManualAccess
										? "N/A"
										: "—"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">
								Next Billing
							</p>
							<p className="font-semibold text-sm">
								{user.nextBilling
									? new Date(
											user.nextBilling,
										).toLocaleDateString()
									: "N/A"}
							</p>
						</div>
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">
								Start Date
							</p>
							<p className="text-sm">
								{user.startDate
									? new Date(
											user.startDate,
										).toLocaleDateString()
									: "N/A"}
							</p>
						</div>
					</div>

					<Separator />

					<Tabs
						defaultValue={
							isManualAccess ? "convert" : "free-months"
						}
						className="w-full"
					>
						{isManualAccess ? (
							<TabsList className="grid w-full grid-cols-1">
								<TabsTrigger value="convert" className="gap-2">
									<DollarSign className="h-4 w-4" />
									<span className="hidden sm:inline">
										Convert to Paid
									</span>
								</TabsTrigger>
							</TabsList>
						) : (
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger
									value="free-months"
									className="gap-2"
								>
									<Gift className="h-4 w-4" />
									<span className="hidden sm:inline">
										Free Months
									</span>
								</TabsTrigger>
								<TabsTrigger
									value="change-plan"
									className="gap-2"
								>
									<DollarSign className="h-4 w-4" />
									<span className="hidden sm:inline">
										Change Plan
									</span>
								</TabsTrigger>
								<TabsTrigger value="cancel" className="gap-2">
									<X className="h-4 w-4" />
									<span className="hidden sm:inline">
										Cancel
									</span>
								</TabsTrigger>
							</TabsList>
						)}

						<TabsContent
							value="free-months"
							className="space-y-4 mt-4"
						>
							<div>
								<h4 className="text-sm font-semibold mb-1">
									Grant Free Months
								</h4>
								<p className="text-xs text-muted-foreground">
									Apply a Stripe coupon to pause billing for
									the specified duration
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="free-months">
									Number of Months
								</Label>
								<Input
									id="free-months"
									type="number"
									min="1"
									max="12"
									value={freeMonths}
									onChange={(e) =>
										setFreeMonths(e.target.value)
									}
								/>
								<p className="text-xs text-muted-foreground">
									User won't be charged for {freeMonths}{" "}
									month(s)
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="free-months-reason">
									Reason{" "}
									<span className="text-destructive">*</span>
								</Label>
								<Textarea
									id="free-months-reason"
									value={freeMonthsReason}
									onChange={(e) => {
										setFreeMonthsReason(e.target.value);
										if (freeMonthsError) {
											setFreeMonthsError("");
										}
									}}
									placeholder="e.g., Compensation for downtime, customer retention offer"
									rows={3}
									className={
										freeMonthsError
											? "border-destructive"
											: ""
									}
								/>
								{freeMonthsError && (
									<p className="text-xs text-destructive">
										{freeMonthsError}
									</p>
								)}
								<p className="text-xs text-muted-foreground">
									Required for audit logs and compliance
									tracking
								</p>
							</div>

							<Button
								onClick={handleGrantFreeMonths}
								disabled={grantFreeMonthsMutation.isPending}
								className="w-full"
							>
								{grantFreeMonthsMutation.isPending
									? "Processing..."
									: "Apply Free Months"}
							</Button>
						</TabsContent>

						<TabsContent
							value="change-plan"
							className="space-y-4 mt-4"
						>
							<div>
								<h4 className="text-sm font-semibold mb-1">
									Change Subscription Plan
								</h4>
								<p className="text-xs text-muted-foreground">
									Update the user's plan and billing cycle
								</p>
							</div>

							<div className="space-y-2">
								<Label>Select New Plan</Label>
								<RadioGroup
									value={newPlan}
									onValueChange={setNewPlan}
								>
									{sellablePlans.map(
										({ planId, priceId }) => (
											<div
												key={`${planId}-${priceId}`}
												className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
											>
												<RadioGroupItem
													value={planId}
													id={`change-${planId}`}
												/>
												<Label
													htmlFor={`change-${planId}`}
													className="flex-1 cursor-pointer"
												>
													{formatPlanIdForAdminLabel(
														planId,
													)}{" "}
													—{" "}
													{priceLabelForPriceId(
														priceId,
													)}
												</Label>
											</div>
										),
									)}
								</RadioGroup>
							</div>

							<div className="space-y-2">
								<Label>When to apply</Label>
								<RadioGroup
									value={applyTiming}
									onValueChange={(v) =>
										setApplyTiming(v as typeof applyTiming)
									}
								>
									<div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
										<RadioGroupItem
											value="immediate"
											id="immediate"
											className="mt-1"
										/>
										<Label
											htmlFor="immediate"
											className="flex-1 cursor-pointer"
										>
											<span className="block font-medium">
												Immediately
											</span>
											<span className="text-xs text-muted-foreground">
												(user charged/refunded prorated
												amount)
											</span>
										</Label>
									</div>
									<div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
										<RadioGroupItem
											value="next_renewal"
											id="next_renewal"
											className="mt-1"
										/>
										<Label
											htmlFor="next_renewal"
											className="flex-1 cursor-pointer"
										>
											<span className="block font-medium">
												At next renewal
											</span>
											<span className="text-xs text-muted-foreground">
												(
												{user.nextBilling
													? new Date(
															user.nextBilling,
														).toLocaleDateString()
													: "N/A"}
												)
											</span>
										</Label>
									</div>
								</RadioGroup>
							</div>

							<div className="space-y-2">
								<Label htmlFor="plan-change-reason">
									Reason{" "}
									<span className="text-destructive">*</span>
								</Label>
								<Textarea
									id="plan-change-reason"
									value={planChangeReason}
									onChange={(e) => {
										setPlanChangeReason(e.target.value);
										if (planChangeError) {
											setPlanChangeError("");
										}
									}}
									placeholder="e.g., User requested upgrade, special pricing arrangement"
									rows={3}
									className={
										planChangeError
											? "border-destructive"
											: ""
									}
								/>
								{planChangeError && (
									<p className="text-xs text-destructive">
										{planChangeError}
									</p>
								)}
								<p className="text-xs text-muted-foreground">
									Required for audit logs and compliance
									tracking
								</p>
							</div>

							<Button
								onClick={handleChangePlan}
								disabled={
									!newPlan || changePlanMutation.isPending
								}
								className="w-full"
							>
								{changePlanMutation.isPending
									? "Processing..."
									: "Change Plan"}
							</Button>
						</TabsContent>

						<TabsContent value="cancel" className="space-y-4 mt-4">
							<div>
								<h4 className="text-sm font-semibold mb-1">
									Cancel Subscription
								</h4>
								<p className="text-xs text-muted-foreground">
									End this user's subscription access
								</p>
							</div>

							<div className="space-y-2">
								<Label>Cancellation Type</Label>
								<RadioGroup
									value={cancelType}
									onValueChange={(v) =>
										setCancelType(v as typeof cancelType)
									}
								>
									<div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
										<RadioGroupItem
											value="end_of_period"
											id="end_of_period"
											className="mt-1"
										/>
										<Label
											htmlFor="end_of_period"
											className="flex-1 cursor-pointer"
										>
											<span className="block font-medium">
												Cancel at period end
											</span>
											<span className="text-xs text-muted-foreground">
												(user keeps access until{" "}
												{user.nextBilling
													? new Date(
															user.nextBilling,
														).toLocaleDateString()
													: "N/A"}
												)
											</span>
										</Label>
									</div>
									<div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
										<RadioGroupItem
											value="immediate"
											id="immediate-cancel"
											className="mt-1"
										/>
										<Label
											htmlFor="immediate-cancel"
											className="flex-1 cursor-pointer"
										>
											<span className="block font-medium">
												Cancel immediately
											</span>
											<span className="text-xs text-muted-foreground">
												(access ends now, prorated
												refund issued)
											</span>
										</Label>
									</div>
								</RadioGroup>
							</div>

							<div className="space-y-2">
								<Label htmlFor="cancel-reason">
									Reason{" "}
									<span className="text-destructive">*</span>
								</Label>
								<Textarea
									id="cancel-reason"
									value={cancelReason}
									onChange={(e) => {
										setCancelReason(e.target.value);
										if (cancelError) {
											setCancelError("");
										}
									}}
									placeholder="e.g., User requested cancellation, refund due to service issue"
									rows={3}
									className={
										cancelError ? "border-destructive" : ""
									}
								/>
								{cancelError && (
									<p className="text-xs text-destructive">
										{cancelError}
									</p>
								)}
								<p className="text-xs text-muted-foreground">
									Required for audit logs and compliance
									tracking
								</p>
							</div>

							<div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
								<AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
								<p className="text-xs text-amber-500">
									This action cannot be undone. The user will
									receive an email notification.
								</p>
							</div>

							<Button
								onClick={handleCancelSubscription}
								disabled={cancelSubscriptionMutation.isPending}
								variant="error"
								className="w-full"
							>
								{cancelSubscriptionMutation.isPending
									? "Processing..."
									: "Cancel Subscription"}
							</Button>
						</TabsContent>

						{isManualAccess && (
							<TabsContent
								value="convert"
								className="space-y-4 mt-4"
							>
								<div>
									<h4 className="text-sm font-semibold mb-1">
										Convert to Paid Subscription
									</h4>
									<p className="text-xs text-muted-foreground">
										Create a Stripe checkout link for this
										user to migrate from manual access to a
										paid subscription
									</p>
								</div>

								<div className="space-y-2">
									<Label>Select Plan</Label>
									<RadioGroup
										value={newPlan}
										onValueChange={setNewPlan}
									>
										{sellablePlans.map(
											({ planId, priceId }) => (
												<div
													key={`convert-${planId}-${priceId}`}
													className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer"
												>
													<RadioGroupItem
														value={planId}
														id={`convert-${planId}`}
													/>
													<Label
														htmlFor={`convert-${planId}`}
														className="flex-1 cursor-pointer"
													>
														{formatPlanIdForAdminLabel(
															planId,
														)}{" "}
														—{" "}
														{priceLabelForPriceId(
															priceId,
														)}
													</Label>
												</div>
											),
										)}
									</RadioGroup>
								</div>

								<div className="space-y-2">
									<Label htmlFor="convert-reason">
										Reason{" "}
										<span className="text-destructive">
											*
										</span>
									</Label>
									<Textarea
										id="convert-reason"
										value={convertReason}
										onChange={(e) => {
											setConvertReason(e.target.value);
											if (convertError) {
												setConvertError("");
											}
										}}
										placeholder="e.g., User requested to convert to paid subscription"
										rows={3}
										className={
											convertError
												? "border-destructive"
												: ""
										}
									/>
									{convertError && (
										<p className="text-xs text-destructive">
											{convertError}
										</p>
									)}
									<p className="text-xs text-muted-foreground">
										Required for audit logs and compliance
										tracking
									</p>
								</div>

								<Button
									onClick={async () => {
										if (!validateReason(convertReason)) {
											setConvertError(
												"Reason must be at least 10 characters",
											);
											return;
										}

										if (!newPlan) {
											setConvertError(
												"Please select a plan",
											);
											return;
										}

										setConvertError("");

										const toastId = toast.loading(
											"Creating checkout link...",
										);

										try {
											const productId =
												resolveSubscriptionProductIdFromPlanKey(
													newPlan,
												);

											if (!productId) {
												throw new Error(
													"Invalid plan selected",
												);
											}

											const { checkoutLink } =
												await convertToPaidMutation.mutateAsync(
													{
														userId: user.id,
														productId,
														redirectUrl:
															window.location
																.href,
														reason: convertReason,
													},
												);

											toast.success(
												"Checkout link created",
												{
													id: toastId,
												},
											);

											// Open checkout in new tab
											window.open(checkoutLink, "_blank");

											// Invalidate queries
											await queryClient.invalidateQueries(
												{
													queryKey: [
														"admin",
														"users",
														"list",
													],
												},
											);

											onOpenChange(false);
										} catch (error) {
											toast.error(
												error instanceof Error
													? error.message
													: "Failed to create checkout link",
												{ id: toastId },
											);
										}
									}}
									disabled={
										!newPlan ||
										convertToPaidMutation.isPending ||
										!validateReason(convertReason)
									}
									className="w-full"
								>
									{convertToPaidMutation.isPending
										? "Creating..."
										: "Create Checkout Link"}
								</Button>
							</TabsContent>
						)}
					</Tabs>

					<Separator />

					<div className="space-y-3">
						<h4 className="text-sm font-semibold">
							Stripe Customer Details
						</h4>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground min-w-[100px]">
									Customer ID:
								</span>
								<code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">
									{user.stripeCustomerId ||
										"cus_xxxxxxxxxxxxx"}
								</code>
								<Button
									size="sm"
									variant="ghost"
									onClick={() =>
										copyToClipboard(
											user.stripeCustomerId || "",
											"Customer ID",
										)
									}
									className="h-7 w-7 p-0"
								>
									<Copy className="h-3 w-3" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									asChild
									className="h-7 w-7 p-0"
								>
									<a
										href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId || ""}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLink className="h-3 w-3" />
									</a>
								</Button>
							</div>
							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground min-w-[100px]">
									Subscription ID:
								</span>
								<code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">
									{user.stripeSubscriptionId ||
										"sub_xxxxxxxxxxxxx"}
								</code>
								<Button
									size="sm"
									variant="ghost"
									onClick={() =>
										copyToClipboard(
											user.stripeSubscriptionId || "",
											"Subscription ID",
										)
									}
									className="h-7 w-7 p-0"
								>
									<Copy className="h-3 w-3" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
