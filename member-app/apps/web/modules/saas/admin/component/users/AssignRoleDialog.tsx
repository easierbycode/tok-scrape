"use client";

import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
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
import { Separator } from "@ui/components/separator";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	BarChart3,
	Crown,
	Headphones,
	Shield,
	UserIcon,
} from "@/modules/ui/icons";
import { RoleBadge } from "../StatusBadges";

interface User {
	id: string;
	name: string;
	email: string;
	role: string | null;
	avatar?: string;
}

interface AssignRoleDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function roleToFormValue(role: string | null | undefined): string {
	if (!role || role === "user") {
		return "user";
	}
	return role;
}

const ROLE_OPTIONS: Array<{
	value: string;
	title: string;
	description: string;
	icon: typeof UserIcon;
}> = [
	{
		value: "user",
		title: "Standard user",
		description:
			"Access to the member dashboard and features based on subscription. No admin access.",
		icon: UserIcon,
	},
	{
		value: "owner",
		title: "Owner",
		description:
			"Full platform control: admin dashboard, users, billing operations, and settings.",
		icon: Crown,
	},
	{
		value: "admin",
		title: "Administrator",
		description:
			"Full admin dashboard access (same operational powers as owner for day-to-day management).",
		icon: Shield,
	},
	{
		value: "analytics_viewer",
		title: "Analytics viewer",
		description:
			"Read-only access to the analytics dashboard. Cannot access users, subscriptions, or any other admin pages.",
		icon: BarChart3,
	},
	{
		value: "support",
		title: "Support",
		description:
			"Reserved for future support tooling. Same as standard user until those features ship.",
		icon: Headphones,
	},
];

export function AssignRoleDialog({
	user,
	open,
	onOpenChange,
}: AssignRoleDialogProps) {
	const queryClient = useQueryClient();
	const [selectedRole, setSelectedRole] = useState("user");

	useEffect(() => {
		if (open && user) {
			setSelectedRole(roleToFormValue(user.role));
		}
	}, [open, user]);

	const assignRoleMutation = useMutation(
		orpc.admin.users.assignRole.mutationOptions(),
	);

	const handleSubmit = async () => {
		if (!user) {
			return;
		}

		const toastId = toast.loading("Updating user role...");

		try {
			await assignRoleMutation.mutateAsync({
				userId: user.id,
				role:
					selectedRole === "user"
						? undefined
						: (selectedRole as
								| "owner"
								| "analytics_viewer"
								| "admin"
								| "support"),
			});

			toast.success("Role updated. User must sign out and back in.", {
				id: toastId,
			});

			queryClient.invalidateQueries({
				queryKey: orpc.admin.users.list.key(),
			});

			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to update role",
				{ id: toastId },
			);
		}
	};

	if (!user) {
		return null;
	}

	const currentFormValue = roleToFormValue(user.role);
	const hasRoleChanged = selectedRole !== currentFormValue;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
				<DialogHeader>
					<DialogTitle>Assign Role</DialogTitle>
					<DialogDescription>
						Change the user&apos;s role. They must sign out and back
						in for permissions to update.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
						<UserAvatar
							className="h-10 w-10"
							name={user.name ?? user.email}
							avatarUrl={user.avatar}
						/>
						<div className="flex-1 min-w-0">
							<p className="font-medium text-sm truncate">
								{user.name}
							</p>
							<p className="text-xs text-muted-foreground truncate">
								{user.email}
							</p>
						</div>
						<RoleBadge role={user.role} />
					</div>

					<Separator />

					<div className="space-y-4">
						<Label>Select role</Label>
						<RadioGroup
							value={selectedRole}
							onValueChange={setSelectedRole}
							className="space-y-3"
						>
							{ROLE_OPTIONS.map((opt) => {
								const Icon = opt.icon;
								const isPrivileged =
									opt.value !== "user" &&
									opt.value !== "support";
								return (
									<div
										key={opt.value}
										className="flex items-start space-x-3 p-4 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
									>
										<RadioGroupItem
											value={opt.value}
											id={`role-${opt.value}`}
											className="mt-0.5"
										/>
										<Label
											htmlFor={`role-${opt.value}`}
											className="flex-1 cursor-pointer"
										>
											<div className="flex items-center gap-2 mb-2 flex-wrap">
												<Icon className="h-4 w-4 text-muted-foreground shrink-0" />
												<span className="font-semibold">
													{opt.title}
												</span>
												{isPrivileged ? (
													<Badge className="bg-primary/10 text-primary text-xs border-primary/20">
														Elevated
													</Badge>
												) : null}
											</div>
											<p className="text-sm text-muted-foreground">
												{opt.description}
											</p>
										</Label>
									</div>
								);
							})}
						</RadioGroup>
					</div>

					{hasRoleChanged ? (
						<div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
							<p className="text-sm text-amber-600 dark:text-amber-400">
								This updates permissions immediately in the
								database. Confirm before saving.
							</p>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={assignRoleMutation.isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={() => void handleSubmit()}
						disabled={
							!hasRoleChanged || assignRoleMutation.isPending
						}
					>
						{assignRoleMutation.isPending
							? "Updating..."
							: "Update role"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
