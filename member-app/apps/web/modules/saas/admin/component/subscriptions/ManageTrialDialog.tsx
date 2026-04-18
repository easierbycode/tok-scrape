"use client";

import type { SubscriptionWithUser } from "@repo/api/modules/admin/types";
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
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { Separator } from "@ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Textarea } from "@ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";

interface ManageTrialDialogProps {
	subscription: SubscriptionWithUser | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function ManageTrialDialog({
	subscription,
	open,
	onOpenChange,
	onSuccess,
}: ManageTrialDialogProps) {
	const queryClient = useQueryClient();

	const extendTrialMutation = useMutation(
		orpc.admin.subscriptions.extendTrial.mutationOptions(),
	);
	const convertTrialMutation = useMutation(
		orpc.admin.subscriptions.convertTrial.mutationOptions(),
	);

	// Tab 1: Extend Trial
	const [trialDays, setTrialDays] = useState("");
	const [extendReason, setExtendReason] = useState("");

	// Tab 2: Convert to Paid
	const [convertReason, setConvertReason] = useState("");

	const handleExtendTrial = async () => {
		if (!subscription) {
			return;
		}

		const days = Number.parseInt(trialDays, 10);
		if (!days || days < 1 || extendReason.length < 10) {
			toast.error(
				"Please provide valid days (1+) and reason (min 10 characters)",
			);
			return;
		}

		const toastId = toast.loading("Extending trial...");
		try {
			await extendTrialMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				days,
				reason: extendReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success(`Trial extended by ${days} days`, { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to extend trial: ${error.message}`, {
				id: toastId,
			});
		}
	};

	const handleConvertTrial = async () => {
		if (!subscription) {
			return;
		}

		if (convertReason.length < 10) {
			toast.error("Please provide reason (min 10 characters)");
			return;
		}

		const toastId = toast.loading("Converting trial to paid...");
		try {
			await convertTrialMutation.mutateAsync({
				subscriptionId: subscription.subscriptionId,
				reason: convertReason,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});

			toast.success("Trial converted to paid subscription", {
				id: toastId,
			});
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to convert trial: ${error.message}`, {
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
					<DialogTitle className="font-serif font-semibold">
						Manage Trial Subscription
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
					<Badge className="ml-auto border border-primary/30 bg-primary/10 text-primary">
						Trial
					</Badge>
				</div>

				<Separator />

				<Tabs defaultValue="extend" className="w-full">
					<TabsList className="grid grid-cols-2 w-full">
						<TabsTrigger value="extend">Extend Trial</TabsTrigger>
						<TabsTrigger value="convert">
							Convert to Paid
						</TabsTrigger>
					</TabsList>

					<TabsContent value="extend" className="space-y-4">
						<div className="space-y-2">
							<Label>Extend by (days)</Label>
							<Input
								type="number"
								placeholder="7"
								value={trialDays}
								onChange={(e) => setTrialDays(e.target.value)}
								min="1"
							/>
						</div>

						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you extending this trial?"
								value={extendReason}
								onChange={(e) =>
									setExtendReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button onClick={handleExtendTrial} className="w-full">
							Extend Trial
						</Button>
					</TabsContent>

					<TabsContent value="convert" className="space-y-4">
						<div className="space-y-2">
							<Label>Reason (min 10 characters)</Label>
							<Textarea
								placeholder="Why are you converting this trial to paid?"
								value={convertReason}
								onChange={(e) =>
									setConvertReason(e.target.value)
								}
								rows={3}
							/>
						</div>

						<Button onClick={handleConvertTrial} className="w-full">
							Convert to Paid
						</Button>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
