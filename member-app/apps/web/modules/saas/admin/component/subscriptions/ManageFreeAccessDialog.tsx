"use client";

import type { SubscriptionWithUser } from "@repo/api/modules/admin/types";
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
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Separator } from "@ui/components/separator";
import { Textarea } from "@ui/components/textarea";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface ManageFreeAccessDialogProps {
	subscription: SubscriptionWithUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function ManageFreeAccessDialog({
	subscription,
	open,
	onOpenChange,
	onSuccess: _onSuccess,
}: ManageFreeAccessDialogProps) {
	const queryClient = useQueryClient();

	const convertToPaidMutation = useMutation(
		orpc.admin.users.convertToPaid.mutationOptions(),
	);

	const [convertReason, setConvertReason] = useState("");
	const { planByPriceId } = useMarketingPricing();

	const sellablePlans = useMemo(
		() => getSellableSubscriptionPlanPrices(),
		[],
	);
	const [selectedPriceId, setSelectedPriceId] = useState<string>(
		() => sellablePlans[0]?.priceId ?? "",
	);

	function priceLabelForPriceId(priceId: string): string {
		const row = planByPriceId.get(priceId);
		return row
			? `${row.price}${row.period ? ` ${row.period}` : ""}`
			: "N/A";
	}

	const handleConvertToPaid = async () => {
		if (!subscription) {
			return;
		}

		if (convertReason.length < 10) {
			toast.error("Please provide reason (min 10 characters)");
			return;
		}

		const toastId = toast.loading("Creating checkout link...");
		try {
			if (!selectedPriceId) {
				throw new Error("No paid plan is configured");
			}

			const { checkoutLink } = await convertToPaidMutation.mutateAsync({
				userId: subscription.userId,
				productId: selectedPriceId,
				redirectUrl: window.location.href,
				reason: convertReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			window.location.href = checkoutLink;
			toast.success("Redirecting to checkout...", { id: toastId });
		} catch (error: any) {
			toast.error(`Failed to create checkout link: ${error.message}`, {
				id: toastId,
			});
		}
	};

	if (!subscription) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Manage Free Access</DialogTitle>
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
					<Badge className="ml-auto bg-blue-500/10 text-blue-500">
						Manual Access
					</Badge>
				</div>

				<Separator />

				<div className="space-y-4 pt-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">
							Convert this user from manual access to a paid
							subscription. They will be redirected to a checkout
							page to complete the payment setup.
						</p>
					</div>

					<div className="space-y-2">
						<Label>Target plan</Label>
						<Select
							value={selectedPriceId}
							onValueChange={setSelectedPriceId}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a plan" />
							</SelectTrigger>
							<SelectContent>
								{sellablePlans.map(({ planId, priceId }) => (
									<SelectItem key={priceId} value={priceId}>
										{formatPlanIdForAdminLabel(
											String(planId),
										)}{" "}
										— {priceLabelForPriceId(priceId)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Reason (min 10 characters)</Label>
						<Textarea
							placeholder="Why are you converting this to a paid subscription?"
							value={convertReason}
							onChange={(e) => setConvertReason(e.target.value)}
							rows={3}
						/>
					</div>

					<Button
						onClick={handleConvertToPaid}
						className="w-full"
						disabled={
							!selectedPriceId || sellablePlans.length === 0
						}
					>
						Convert to Paid Subscription
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
