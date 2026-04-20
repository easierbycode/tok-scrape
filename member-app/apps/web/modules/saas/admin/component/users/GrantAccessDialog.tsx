"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Label } from "@ui/components/label";
import { Textarea } from "@ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Key } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
}

interface GrantAccessDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function GrantAccessDialog({
	user,
	open,
	onOpenChange,
}: GrantAccessDialogProps) {
	const queryClient = useQueryClient();
	const [reason, setReason] = useState("");

	const grantAccessMutation = useMutation(
		orpc.admin.users.grantAccess.mutationOptions(),
	);

	const handleSubmit = async () => {
		if (!user) {
			return;
		}

		const toastId = toast.loading("Granting manual access...");

		try {
			await grantAccessMutation.mutateAsync({
				userId: user.id,
				reason: reason || undefined,
			});

			toast.success("Manual access granted successfully", {
				id: toastId,
			});

			// Invalidate queries to refresh the users list
			queryClient.invalidateQueries({
				queryKey: orpc.admin.users.list.key(),
			});

			// Close dialog and reset form
			onOpenChange(false);
			setReason("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to grant access",
				{ id: toastId },
			);
		}
	};

	const isValid = true; // Reason is optional

	if (!user) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Key className="h-5 w-5 text-primary" />
						Grant Manual Access
					</DialogTitle>
					<DialogDescription>
						Manually grant subscription access to {user.name}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<Alert>
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription className="text-sm">
							This will create a manual-override purchase record
							to grant access. This action will be logged in the
							audit trail.
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<Label htmlFor="reason">Reason (optional)</Label>
						<Textarea
							id="reason"
							placeholder="Enter the reason for granting manual access (optional)..."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={4}
							className="resize-none"
						/>
						<p className="text-xs text-muted-foreground">
							This will be logged in the audit trail
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={grantAccessMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!isValid || grantAccessMutation.isPending}
					>
						{grantAccessMutation.isPending
							? "Granting..."
							: "Grant Access"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
