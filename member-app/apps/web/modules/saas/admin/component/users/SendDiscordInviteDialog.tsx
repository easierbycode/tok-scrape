"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
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
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
}

interface SendDiscordInviteDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function SendDiscordInviteDialog({
	user,
	open,
	onOpenChange,
}: SendDiscordInviteDialogProps) {
	const queryClient = useQueryClient();
	const [recipientEmail, setRecipientEmail] = useState("");
	const [relationship, setRelationship] = useState<
		"spouse" | "partner" | "family" | ""
	>("");

	const sendInviteMutation = useMutation(
		orpc.admin.users.sendDiscordInvite.mutationOptions(),
	);

	const handleSubmit = async () => {
		if (!user || !recipientEmail || !relationship) {
			return;
		}

		const toastId = toast.loading("Sending Discord invite...");

		try {
			await sendInviteMutation.mutateAsync({
				primaryUserId: user.id,
				recipientEmail,
				relationship,
			});

			toast.success(
				"Invite sent — the account will appear in Additional Accounts once they join the server.",
				{ id: toastId },
			);

			queryClient.invalidateQueries({
				queryKey: orpc.admin.users.list.key(),
			});

			onOpenChange(false);
			setRecipientEmail("");
			setRelationship("");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to send invite";
			toast.error(message, { id: toastId });
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<UserPlus className="h-5 w-5 text-primary" />
						Send Discord Invite
					</DialogTitle>
					<DialogDescription>
						Send a Discord server invite to a spouse, partner, or
						family member of {user?.name ?? user?.email}. They will
						receive an email with a link to join the server.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="recipientEmail">Recipient email</Label>
						<Input
							id="recipientEmail"
							type="email"
							placeholder="spouse@example.com"
							value={recipientEmail}
							onChange={(e) => setRecipientEmail(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="relationship">Relationship</Label>
						<Select
							value={relationship}
							onValueChange={(v) =>
								setRelationship(
									v as "spouse" | "partner" | "family",
								)
							}
						>
							<SelectTrigger id="relationship">
								<SelectValue placeholder="Select relationship" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="spouse">Spouse</SelectItem>
								<SelectItem value="partner">Partner</SelectItem>
								<SelectItem value="family">Family</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={sendInviteMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							!recipientEmail ||
							!relationship ||
							sendInviteMutation.isPending
						}
					>
						{sendInviteMutation.isPending
							? "Sending..."
							: "Send Invite"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
