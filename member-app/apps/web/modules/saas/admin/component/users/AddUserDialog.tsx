"use client";

import { orpcClient } from "@shared/lib/orpc-client";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, UserPlus, Users } from "@/modules/ui/icons";

interface AddUserDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	prefilledData?: {
		email: string;
		name?: string;
		affiliateContext?: {
			rewardfulId: string;
			isAffiliate: true;
		};
	};
}

export function AddUserDialog({
	open,
	onOpenChange,
	prefilledData,
}: AddUserDialogProps) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(prefilledData?.name || "");
	const [email, setEmail] = useState(prefilledData?.email || "");
	const [isAdmin, setIsAdmin] = useState(false);
	const [sendEmail, setSendEmail] = useState(true);

	// Reset when prefilledData changes
	useEffect(() => {
		if (prefilledData) {
			setName(prefilledData.name || "");
			setEmail(prefilledData.email);
		} else {
			setName("");
			setEmail("");
		}
	}, [prefilledData]);

	const addUserMutation = useMutation(
		orpc.admin.users.addUser.mutationOptions(),
	);

	const handleSubmit = async () => {
		// Validation
		if (!name.trim()) {
			toast.error("Please enter a name");
			return;
		}

		if (!email.trim() || !email.includes("@")) {
			toast.error("Please enter a valid email address");
			return;
		}

		const toastId = toast.loading("Creating user...");

		try {
			const result = await addUserMutation.mutateAsync({
				name,
				email,
				role: isAdmin ? "admin" : undefined,
				sendEmail,
			});

			// Link to Rewardful affiliate if creating from affiliate context
			if (prefilledData?.affiliateContext) {
				try {
					await orpcClient.admin.rewardful.linkToUser({
						userId: result.user.id,
						rewardfulId: prefilledData.affiliateContext.rewardfulId,
					});
					toast.success(
						`User created and linked to affiliate! ${name} has been added.${
							sendEmail ? " Verification email sent." : ""
						}`,
						{ id: toastId },
					);
				} catch (linkError) {
					toast.error(
						`User created but failed to link affiliate: ${linkError instanceof Error ? linkError.message : "Unknown error"}`,
						{ id: toastId },
					);
				}
			} else {
				toast.success(
					`User created successfully! ${name} has been added.${
						sendEmail ? " Verification email sent." : ""
					}`,
					{ id: toastId },
				);
			}

			// Reset form
			setName("");
			setEmail("");
			setIsAdmin(false);
			setSendEmail(true);

			// Invalidate queries
			queryClient.invalidateQueries({
				queryKey: ["admin", "users", "list"],
			});
			queryClient.invalidateQueries({
				queryKey: ["admin", "affiliates", "list"],
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to create user",
				{ id: toastId },
			);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add New User</DialogTitle>
					<DialogDescription>
						Create a new user account. Grant access separately after
						creation.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Affiliate Context Banner */}
					{prefilledData?.affiliateContext && (
						<div className="mb-4 rounded border border-blue-500/30 bg-blue-500/5 p-3">
							<div className="flex items-center gap-2 text-sm">
								<Users className="h-4 w-4 text-blue-500" />
								<span className="font-medium text-blue-700">
									Creating account for Rewardful affiliate
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								This account will be automatically linked to
								their affiliate profile
							</p>
						</div>
					)}
					{/* User Information */}
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Full Name *</Label>
							<Input
								id="name"
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="email">Email Address *</Label>
							<Input
								id="email"
								type="email"
								placeholder="john.doe@example.com"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
					</div>

					{/* Additional Options */}
					<div className="space-y-3">
						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<Label className="text-base">Admin Role</Label>
								<p className="text-sm text-muted-foreground">
									Grant administrative privileges to this user
								</p>
							</div>
							<Button
								variant={isAdmin ? "secondary" : "outline"}
								size="sm"
								onClick={() => setIsAdmin(!isAdmin)}
							>
								{isAdmin ? "Admin" : "User"}
							</Button>
						</div>

						<div className="flex items-center justify-between rounded-lg border p-4">
							<div className="space-y-0.5">
								<Label className="text-base">
									Send Verification Email
								</Label>
								<p className="text-sm text-muted-foreground">
									User will receive email to set password and
									verify account
								</p>
							</div>
							<Button
								variant={sendEmail ? "secondary" : "outline"}
								size="sm"
								onClick={() => setSendEmail(!sendEmail)}
							>
								{sendEmail ? "Yes" : "No"}
							</Button>
						</div>
					</div>

					{/* Info Box */}
					<div className="rounded-lg bg-muted p-4 space-y-2">
						<div className="flex items-start gap-2">
							<Lightbulb className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
							<div className="space-y-1 text-sm text-muted-foreground">
								<p className="font-medium text-foreground">
									Next Steps:
								</p>
								<ul className="list-disc list-inside space-y-1">
									<li>
										User account will be created (no access
										granted yet)
									</li>
									<li>
										To grant access: Use "Grant Access" from
										the user's menu
									</li>
									<li>
										User will receive verification email to
										set password
									</li>
									<li>
										All actions are logged in the audit
										trail
									</li>
								</ul>
							</div>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={addUserMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={addUserMutation.isPending}
					>
						<UserPlus className="mr-2 h-4 w-4" />
						{addUserMutation.isPending
							? "Creating User..."
							: "Create User"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
