"use client";

import { orpcClient } from "@shared/lib/orpc-client";
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
import { RadioGroup, RadioGroupItem } from "@ui/components/radio-group";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, UserX } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
	subscriptionStatus?: string;
}

interface DeleteUserDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUserDeleted?: () => void;
}

export function DeleteUserDialog({
	user,
	open,
	onOpenChange,
	onUserDeleted,
}: DeleteUserDialogProps) {
	const [reason, setReason] = useState<
		"user_request" | "admin_action" | "gdpr"
	>("admin_action");

	const handleSubmit = async () => {
		if (!user) {
			return;
		}

		const toastId = toast.loading(`Deleting ${user.name}...`);

		try {
			await orpcClient.admin.users.deleteUser({
				userId: user.id,
				reason,
				immediate: false,
			});

			toast.success(
				"User scheduled for deletion. Data preserved for 30 days (restorable). PII anonymized at purge.",
				{ id: toastId },
			);

			onOpenChange(false);
			onUserDeleted?.();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to delete user",
				{ id: toastId },
			);
		}
	};

	if (!user) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<UserX className="h-5 w-5 text-destructive" />
						Delete User (GDPR Compliant)
					</DialogTitle>
					<DialogDescription>
						Remove {user.name} ({user.email}). User data is
						preserved for 30 days and can be restored. PII is
						anonymized after the grace period.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<Alert className="border-destructive/20 bg-destructive/10">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						<AlertDescription className="text-sm">
							User data is preserved during the 30-day grace
							period and can be fully restored. After the grace
							period, PII is anonymized and the account is
							permanently removed. Financial records are retained
							for 7 years (EU requirement).
						</AlertDescription>
					</Alert>

					<div className="space-y-2">
						<Label>Deletion reason</Label>
						<RadioGroup
							value={reason}
							onValueChange={(v) =>
								setReason(
									v as
										| "user_request"
										| "admin_action"
										| "gdpr",
								)
							}
							className="flex flex-col gap-2"
						>
							<div className="flex items-center space-x-2">
								<RadioGroupItem
									value="admin_action"
									id="admin_action"
								/>
								<Label
									htmlFor="admin_action"
									className="font-normal"
								>
									Admin action
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem
									value="user_request"
									id="user_request"
								/>
								<Label
									htmlFor="user_request"
									className="font-normal"
								>
									User request
								</Label>
							</div>
							<div className="flex items-center space-x-2">
								<RadioGroupItem value="gdpr" id="gdpr" />
								<Label htmlFor="gdpr" className="font-normal">
									GDPR / data request
								</Label>
							</div>
						</RadioGroup>
					</div>

					<p className="text-xs text-muted-foreground">
						30-day grace period: User can be restored from pending
						deletions before purge.
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button variant="error" onClick={handleSubmit}>
						Delete User
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
