"use client";

import type { SubscriptionWithUser } from "@repo/api/modules/admin/types";
import { formatDate } from "@saas/admin/lib/subscription-utils";
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
import { Separator } from "@ui/components/separator";
import { Textarea } from "@ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";

interface ViewInactiveSubscriptionDialogProps {
	subscription: SubscriptionWithUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function ViewInactiveSubscriptionDialog({
	subscription,
	open,
	onOpenChange,
	onSuccess,
}: ViewInactiveSubscriptionDialogProps) {
	const queryClient = useQueryClient();
	const [reactivateReason, setReactivateReason] = useState("");

	const reactivateMutation = useMutation(
		orpc.admin.subscriptions.reactivate.mutationOptions(),
	);

	const handleReactivate = async () => {
		if (!subscription) {
			return;
		}

		if (reactivateReason.length < 10) {
			toast.error("Please provide reason (min 10 characters)");
			return;
		}

		const toastId = toast.loading("Reactivating subscription...");
		try {
			await reactivateMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				reason: reactivateReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success("Subscription reactivated successfully", {
				id: toastId,
			});
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to reactivate: ${error.message}`, {
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
					<DialogTitle>View Inactive Subscription</DialogTitle>
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
					<Badge className="ml-auto bg-red-500/10 text-red-500">
						Cancelled
					</Badge>
				</div>

				<Separator />

				{/* Subscription Details */}
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label className="text-muted-foreground">
								Plan
							</Label>
							<p className="font-medium">{subscription.plan}</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Amount
							</Label>
							<p className="font-medium">
								${subscription.amount}/
								{subscription.plan.includes("Monthly")
									? "mo"
									: "yr"}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Cancelled At
							</Label>
							<p className="font-medium">
								{subscription.canceledAt
									? formatDate(subscription.canceledAt)
									: "Unknown"}
							</p>
						</div>
						<div>
							<Label className="text-muted-foreground">
								Cancel Reason
							</Label>
							<p className="font-medium">
								{subscription.cancelReason || "Not provided"}
							</p>
						</div>
					</div>

					<Separator />

					{/* Reactivate Section */}
					<div className="space-y-4">
						<h3 className="font-medium">Reactivate Subscription</h3>
						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you reactivating this subscription?"
								value={reactivateReason}
								onChange={(e) =>
									setReactivateReason(e.target.value)
								}
								rows={3}
							/>
						</div>
						<Button onClick={handleReactivate} className="w-full">
							Reactivate Subscription
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
