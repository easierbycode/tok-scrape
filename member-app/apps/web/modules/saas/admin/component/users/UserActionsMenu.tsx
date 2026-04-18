"use client";

import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import { useAdminContext } from "@saas/admin/lib/admin-context";
import { useSession } from "@saas/auth/hooks/use-session";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";
import {
	CreditCard,
	Download,
	Eye,
	Key,
	EyeOff as KeyOff,
	Link2Off,
	MoreVertical,
	RefreshCw,
	Repeat1,
	Shield,
	UserCog,
	UserIcon,
	UserPlus,
	UserX,
} from "@/modules/ui/icons";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { ExportUserDataDialog } from "./ExportUserDataDialog";

interface User {
	id: string;
	name: string;
	email: string;
	emailVerified?: boolean;
	connectedAccounts?: Array<{ providerId: string }>;
	discordId?: string;
	subscriptionStatus:
		| "active"
		| "cancelled"
		| "grace_period"
		| "scheduled_cancel"
		| "none"
		| "manual"
		| "trial"
		| "lifetime";
}

interface UserActionsMenuProps {
	user: User;
	onViewOverview: () => void;
	onManageSubscription: () => void;
	onAssignRole: () => void;
	onGrantAccess: () => void;
	onRevokeAccess: () => void;
	onViewSubscription: () => void;
	onSendDiscordInvite?: () => void;
	onUserDeleted?: () => void;
	onDiscordChanged?: () => void;
}

export function UserActionsMenu({
	user,
	onViewOverview,
	onManageSubscription,
	onAssignRole,
	onGrantAccess,
	onRevokeAccess,
	onViewSubscription,
	onSendDiscordInvite,
	onUserDeleted,
	onDiscordChanged,
}: UserActionsMenuProps) {
	const { user: currentUser } = useSession();
	const { confirm } = useConfirmationAlert();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [exportDialogOpen, setExportDialogOpen] = useState(false);

	const { isSuperAdmin } = useAdminContext();

	const handleImpersonate = async () => {
		// Only super admins can impersonate
		if (!isSuperAdmin) {
			toast.error("Only super admins can impersonate users");
			return;
		}

		if (process.env.NODE_ENV === "development") {
			logger.debug("Impersonation attempt", {
				targetUserId: user.id,
				targetName: user.name,
				targetEmail: user.email,
				currentUser: currentUser?.email,
				isSuperAdmin,
				isSuperAdminFromContext: isSuperAdmin,
			});
		}

		const toastId = toast.loading(`Impersonating ${user.name}...`);

		try {
			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 1: Calling ORPC audit log");
			}
			// Call ORPC procedure for audit logging
			const auditResult = await orpcClient.admin.users.impersonate({
				userId: user.id,
			});
			if (process.env.NODE_ENV === "development") {
				logger.debug("ORPC audit logged", { auditResult });
			}

			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 2: Calling Better-Auth impersonation");
			}
			// Call Better-Auth for actual impersonation
			const impersonateResult = await authClient.admin.impersonateUser({
				userId: user.id,
			});
			if (process.env.NODE_ENV === "development") {
				logger.debug("Better-Auth impersonation result", {
					impersonateResult,
				});
			}

			if (impersonateResult.error) {
				throw new Error(
					impersonateResult.error.message ??
						"Better-Auth rejected impersonation",
				);
			}

			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 3: Redirecting to /app");
			}
			toast.dismiss(toastId);
			window.location.href = new URL(
				"/app",
				window.location.origin,
			).toString();
		} catch (error) {
			logger.error("Impersonation failed", { error });
			if (process.env.NODE_ENV === "development") {
				logger.debug("Error details", {
					message:
						error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					fullError: error,
				});
			}
			toast.dismiss(toastId);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to impersonate user",
			);
		}
	};

	const handleUnlinkDiscord = async () => {
		try {
			await orpcClient.admin.users.unlinkDiscordAccount({
				userId: user.id,
				reason: "Admin action — allow reconnect with different account",
			});
			toast.success(`Discord account unlinked from ${user.name}`);
			onDiscordChanged?.();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to unlink Discord account",
			);
		}
	};

	const handleSyncDiscordRole = async () => {
		const toastId = toast.loading("Syncing Discord role...");
		try {
			await orpcClient.admin.discord.syncDiscordRole({ userId: user.id });
			toast.dismiss(toastId);
			toast.success(`Discord role synced for ${user.name}`);
			onDiscordChanged?.();
		} catch (error) {
			toast.dismiss(toastId);
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to sync Discord role",
			);
		}
	};

	const handleDelete = () => {
		setDeleteDialogOpen(true);
	};

	const canResendSetupEmail =
		user.emailVerified === false &&
		!user.connectedAccounts?.some((a) => a.providerId === "credential");

	const handleResendSetupEmail = async () => {
		const toastId = toast.loading("Sending setup email...");
		try {
			await orpcClient.admin.users.resendSetupAccountEmail({
				userId: user.id,
			});
			toast.success("Setup email sent — link expires in 24 hours", {
				id: toastId,
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to send email",
				{ id: toastId },
			);
		}
	};

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" className="h-8 w-8">
						<MoreVertical className="h-4 w-4" />
						<span className="sr-only">Open menu</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					collisionPadding={16}
					className="w-[220px]"
				>
					<DropdownMenuLabel>User Actions</DropdownMenuLabel>
					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={onViewOverview}>
						<UserIcon className="mr-2 h-4 w-4" />
						View Overview
					</DropdownMenuItem>

					{canResendSetupEmail && (
						<DropdownMenuItem onClick={handleResendSetupEmail}>
							<Repeat1 className="mr-2 h-4 w-4" />
							Resend setup email
						</DropdownMenuItem>
					)}

					<DropdownMenuItem onClick={onManageSubscription}>
						<CreditCard className="mr-2 h-4 w-4" />
						Manage Subscription
					</DropdownMenuItem>

					<DropdownMenuItem onClick={onAssignRole}>
						<UserCog className="mr-2 h-4 w-4" />
						Assign Role
					</DropdownMenuItem>

					<DropdownMenuSeparator />

					<DropdownMenuItem onClick={onViewSubscription}>
						<Eye className="mr-2 h-4 w-4" />
						View Subscription Details
					</DropdownMenuItem>

					<DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
						<Download className="mr-2 h-4 w-4" />
						Export User Data
					</DropdownMenuItem>

					{onSendDiscordInvite && (
						<DropdownMenuItem onClick={onSendDiscordInvite}>
							<UserPlus className="mr-2 h-4 w-4" />
							Send Discord Invite
						</DropdownMenuItem>
					)}

					{user.discordId && (
						<>
							<DropdownMenuItem onClick={handleSyncDiscordRole}>
								<RefreshCw className="mr-2 h-4 w-4" />
								Sync Discord Role
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() =>
									confirm({
										title: "Unlink Discord Account",
										message: `Completely remove the Discord account link from ${user.name}? This clears their Discord ID and OAuth connection so they can connect a different Discord account. If they are still in the server, they will also be removed.`,
										confirmLabel: "Unlink Account",
										destructive: true,
										onConfirm: handleUnlinkDiscord,
									})
								}
							>
								<Link2Off className="mr-2 h-4 w-4" />
								Unlink Discord Account
							</DropdownMenuItem>
						</>
					)}

					{isSuperAdmin && (
						<DropdownMenuItem onClick={handleImpersonate}>
							<Shield className="mr-2 h-4 w-4" />
							Impersonate User
						</DropdownMenuItem>
					)}

					<DropdownMenuSeparator />

					{(user.subscriptionStatus === "none" ||
						user.subscriptionStatus === "cancelled") && (
						<DropdownMenuItem
							onClick={onGrantAccess}
							className="text-blue-500"
						>
							<Key className="mr-2 h-4 w-4" />
							Grant Manual Access
						</DropdownMenuItem>
					)}

					{user.subscriptionStatus === "manual" && (
						<DropdownMenuItem
							onClick={onRevokeAccess}
							className="text-amber-500"
						>
							<KeyOff className="mr-2 h-4 w-4" />
							Revoke Manual Access
						</DropdownMenuItem>
					)}

					{(user.subscriptionStatus === "none" ||
						user.subscriptionStatus === "cancelled" ||
						user.subscriptionStatus === "manual") && (
						<DropdownMenuSeparator />
					)}

					<DropdownMenuItem
						onClick={handleDelete}
						className="text-destructive"
					>
						<UserX className="mr-2 h-4 w-4" />
						Delete User
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<DeleteUserDialog
				user={user}
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onUserDeleted={onUserDeleted}
			/>

			<ExportUserDataDialog
				user={user}
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
			/>
		</>
	);
}
