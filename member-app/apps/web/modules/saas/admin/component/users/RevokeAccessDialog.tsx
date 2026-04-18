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
import { AlertTriangle, EyeOff as KeyOff } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
}

interface RevokeAccessDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RevokeAccessDialog({
	user,
	open,
	onOpenChange,
}: RevokeAccessDialogProps) {
	const queryClient = useQueryClient();
	const [reason, setReason] = useState("");

	const revokeAccessMutation = useMutation(
		orpc.admin.users.revokeAccess.mutationOptions(),
	);

	const handleSubmit = async () => {
		if (!user) {
			return;
		}

		const toastId = toast.loading("Revoking manual access...");

		try {
			await revokeAccessMutation.mutateAsync({
				userId: user.id,
				reason: reason || undefined,
			});

			toast.success("Manual access revoked successfully", {
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
					: "Failed to revoke access",
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
						<KeyOff className="h-5 w-5 text-amber-500" />
						Revoke Manual Access
					</DialogTitle>
					<DialogDescription>
						Remove manual subscription access from {user.name}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<Alert className="border-amber-500/20 bg-amber-500/10">
						<AlertTriangle className="h-4 w-4 text-amber-500" />
						<AlertDescription className="text-sm text-amber-600 dark:text-amber-400">
							This will immediately revoke the user's manual
							access. This action will be logged in the audit
							trail.
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<Label htmlFor="reason">Reason (optional)</Label>
						<Textarea
							id="reason"
							placeholder="Enter the reason for revoking manual access (optional)..."
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
						disabled={revokeAccessMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!isValid || revokeAccessMutation.isPending}
						className="bg-amber-500 hover:bg-amber-600"
					>
						{revokeAccessMutation.isPending
							? "Revoking..."
							: "Revoke Access"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
