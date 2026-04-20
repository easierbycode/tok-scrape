"use client";

import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import { useAdminContext } from "@saas/admin/lib/admin-context";
import { shortAppRoleLabel } from "@saas/admin/lib/app-role-label";
import { useSession } from "@saas/auth/hooks/use-session";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import { Pagination } from "@saas/shared/components/Pagination";
import { Spinner } from "@shared/components/Spinner";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import { Table, TableBody, TableCell, TableRow } from "@ui/components/table";
import { useTranslations } from "next-intl";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import {
	Ban,
	CheckCircle,
	MoreVerticalIcon,
	Repeat1Icon,
	ShieldCheckIcon,
	ShieldXIcon,
	SquareUserRoundIcon,
	TrashIcon,
	UserPlusIcon,
} from "@/modules/ui/icons";
import { EmailVerified } from "../EmailVerified";
import { AssignRoleDialog } from "./AssignRoleDialog";
import { GrantAccessDialog } from "./GrantAccessDialog";
import { RevokeAccessDialog } from "./RevokeAccessDialog";
import { SendDiscordInviteDialog } from "./SendDiscordInviteDialog";

const ITEMS_PER_PAGE = 10;

export function UserList() {
	const t = useTranslations();
	const _queryClient = useQueryClient();
	const { confirm } = useConfirmationAlert();
	const { user: currentUser } = useSession();
	const [currentPage, setCurrentPage] = useQueryState(
		"currentPage",
		parseAsInteger.withDefault(1),
	);
	const [searchTerm, setSearchTerm] = useQueryState(
		"query",
		parseAsString.withDefault(""),
	);
	const [debouncedSearchTerm, setDebouncedSearchTerm] = useDebounceValue(
		searchTerm,
		300,
		{
			leading: true,
			trailing: false,
		},
	);

	const { isSuperAdmin } = useAdminContext();

	// Dialog state
	const [grantAccessDialog, setGrantAccessDialog] = useState<{
		open: boolean;
		user: any | null;
	}>({
		open: false,
		user: null,
	});
	const [revokeAccessDialog, setRevokeAccessDialog] = useState<{
		open: boolean;
		user: any | null;
	}>({
		open: false,
		user: null,
	});
	const [assignRoleDialog, setAssignRoleDialog] = useState<{
		open: boolean;
		user: any | null;
	}>({
		open: false,
		user: null,
	});
	const [sendInviteDialog, setSendInviteDialog] = useState<{
		open: boolean;
		user: any | null;
	}>({
		open: false,
		user: null,
	});

	useEffect(() => {
		setDebouncedSearchTerm(searchTerm);
	}, [searchTerm]);

	const { data, isLoading, refetch } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: {
				itemsPerPage: ITEMS_PER_PAGE,
				currentPage,
				searchTerm: debouncedSearchTerm,
			},
		}),
	);

	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedSearchTerm]);

	const impersonateUser = async (
		userId: string,
		{ name }: { name: string },
	) => {
		if (process.env.NODE_ENV === "development") {
			logger.debug("Impersonation attempt", {
				targetUserId: userId,
				targetName: name,
				currentUser: currentUser?.email,
				isSuperAdmin,
				isSuperAdminFromContext: isSuperAdmin,
			});
		}

		const toastId = toast.loading(
			t("admin.users.impersonation.impersonating", {
				name,
			}),
		);

		try {
			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 1: Calling ORPC audit log");
			}
			// Call ORPC procedure for audit logging
			const auditResult = await orpcClient.admin.users.impersonate({
				userId,
			});
			if (process.env.NODE_ENV === "development") {
				logger.debug("ORPC audit logged", { auditResult });
			}

			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 2: Calling Better-Auth impersonation");
			}
			// Call Better-Auth for actual impersonation
			const impersonateResult = await authClient.admin.impersonateUser({
				userId,
			});
			if (process.env.NODE_ENV === "development") {
				logger.debug("Better-Auth impersonation result", {
					impersonateResult,
				});
			}

			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 3: Refetching user list");
			}
			await refetch();

			if (process.env.NODE_ENV === "development") {
				logger.debug("Step 4: Redirecting to /app");
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

	const deleteUser = async (id: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.admin.removeUser({
					userId: id,
				});

				if (error) {
					throw error;
				}
			},
			{
				loading: t("admin.users.deleteUser.deleting"),
				success: () => {
					return t("admin.users.deleteUser.deleted");
				},
				error: t("admin.users.deleteUser.notDeleted"),
			},
		);
	};

	const resendVerificationMail = async (email: string) => {
		toast.promise(
			async () => {
				const { error } = await authClient.sendVerificationEmail({
					email,
				});

				if (error) {
					throw error;
				}
			},
			{
				loading: t("admin.users.resendVerificationMail.submitting"),
				success: () => {
					return t("admin.users.resendVerificationMail.success");
				},
				error: t("admin.users.resendVerificationMail.error"),
			},
		);
	};

	const handleBanDiscord = async (userId: string) => {
		const reason = prompt("Reason for Discord ban:");
		if (!reason) {
			return;
		}

		try {
			await orpcClient.admin.users.banUserFromDiscord({ userId, reason });
			toast.success("User banned from Discord");
			refetch();
		} catch (_error) {
			toast.error("Failed to ban user");
		}
	};

	const handleUnbanDiscord = async (userId: string) => {
		confirm({
			title: "Unban user from Discord?",
			message: "They will be able to reconnect to the Discord server.",
			confirmLabel: "Unban",
			onConfirm: async () => {
				try {
					await orpcClient.admin.users.unbanUserFromDiscord({
						userId,
					});
					toast.success("User unbanned from Discord");
					refetch();
				} catch (_error) {
					toast.error("Failed to unban user");
				}
			},
		});
	};

	const columns: ColumnDef<
		NonNullable<
			Awaited<ReturnType<typeof authClient.admin.listUsers>>["data"]
		>["users"][number]
	>[] = useMemo(
		() => [
			{
				accessorKey: "user",
				header: "",
				accessorFn: (row) => row.name,
				cell: ({ row }) => (
					<div className="flex items-center gap-2">
						<UserAvatar
							name={row.original.name ?? row.original.email}
							avatarUrl={row.original.image}
						/>
						<div className="leading-tight">
							<strong className="block">
								{row.original.name ?? row.original.email}
							</strong>
							<small className="flex items-center gap-1 text-foreground/60">
								<span className="block">
									{!!row.original.name && row.original.email}
								</span>
								<EmailVerified
									verified={row.original.emailVerified}
								/>
								<strong className="block">
									{shortAppRoleLabel(row.original.role)}
								</strong>
							</small>
						</div>
					</div>
				),
			},
			{
				accessorKey: "actions",
				header: "",
				cell: ({ row }) => {
					return (
						<div className="flex flex-row justify-end gap-2">
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="icon" variant="ghost">
										<MoreVerticalIcon className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									{isSuperAdmin && (
										<DropdownMenuItem
											onClick={() =>
												impersonateUser(
													row.original.id,
													{
														name:
															row.original.name ??
															"",
													},
												)
											}
										>
											<SquareUserRoundIcon className="mr-2 size-4" />
											{t("admin.users.impersonate")}
										</DropdownMenuItem>
									)}

									{!row.original.emailVerified && (
										<DropdownMenuItem
											onClick={() =>
												resendVerificationMail(
													row.original.email,
												)
											}
										>
											<Repeat1Icon className="mr-2 size-4" />
											{t(
												"admin.users.resendVerificationMail.title",
											)}
										</DropdownMenuItem>
									)}

									<DropdownMenuItem
										onClick={() =>
											setGrantAccessDialog({
												open: true,
												user: row.original,
											})
										}
									>
										<ShieldCheckIcon className="mr-2 size-4" />
										Grant Access
									</DropdownMenuItem>

									<DropdownMenuItem
										onClick={() =>
											setRevokeAccessDialog({
												open: true,
												user: row.original,
											})
										}
									>
										<ShieldXIcon className="mr-2 size-4" />
										Revoke Access
									</DropdownMenuItem>

									{row.original.discordBanned ? (
										<DropdownMenuItem
											onClick={() =>
												handleUnbanDiscord(
													row.original.id,
												)
											}
										>
											<CheckCircle className="mr-2 size-4" />
											Unban from Discord
										</DropdownMenuItem>
									) : (
										<DropdownMenuItem
											onClick={() =>
												handleBanDiscord(
													row.original.id,
												)
											}
											className="text-destructive focus:text-destructive"
										>
											<Ban className="mr-2 size-4" />
											Ban from Discord
										</DropdownMenuItem>
									)}

									<DropdownMenuItem
										onClick={() =>
											setSendInviteDialog({
												open: true,
												user: row.original,
											})
										}
									>
										<UserPlusIcon className="mr-2 size-4" />
										Send Discord Invite
									</DropdownMenuItem>

									<DropdownMenuItem
										onClick={() =>
											setAssignRoleDialog({
												open: true,
												user: {
													id: row.original.id,
													name: row.original.name,
													email: row.original.email,
													role: row.original.role,
												},
											})
										}
									>
										<SquareUserRoundIcon className="mr-2 size-4" />
										Assign Role
									</DropdownMenuItem>

									<DropdownMenuItem
										onClick={() =>
											confirm({
												title: t(
													"admin.users.confirmDelete.title",
												),
												message: t(
													"admin.users.confirmDelete.message",
												),
												confirmLabel: t(
													"admin.users.confirmDelete.confirm",
												),
												destructive: true,
												onConfirm: () =>
													deleteUser(row.original.id),
											})
										}
									>
										<span className="flex items-center text-destructive hover:text-destructive">
											<TrashIcon className="mr-2 size-4" />
											{t("admin.users.delete")}
										</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					);
				},
			},
		],
		[],
	);

	const users = useMemo(() => data?.users ?? [], [data?.users]);

	const table = useReactTable({
		data: users,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		manualPagination: true,
	});

	return (
		<Card className="p-6">
			<h2 className="mb-4 font-semibold text-2xl">
				{t("admin.users.title")}
			</h2>
			<Input
				type="search"
				placeholder={t("admin.users.search")}
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				className="mb-4"
			/>

			<div className="rounded-md border">
				<Table>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
									className="group"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="py-2 group-first:rounded-t-md group-last:rounded-b-md"
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									{isLoading ? (
										<div className="flex h-full items-center justify-center">
											<Spinner className="mr-2 size-4 text-primary" />
											{t("admin.users.loading")}
										</div>
									) : (
										<p>No results.</p>
									)}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{data?.total && data.total > ITEMS_PER_PAGE && (
				<Pagination
					className="mt-4"
					totalItems={data.total}
					itemsPerPage={ITEMS_PER_PAGE}
					currentPage={currentPage}
					onChangeCurrentPage={setCurrentPage}
				/>
			)}

			{/* Dialogs */}
			<GrantAccessDialog
				open={grantAccessDialog.open}
				onOpenChange={(open) =>
					setGrantAccessDialog({
						open,
						user: open ? grantAccessDialog.user : null,
					})
				}
				user={grantAccessDialog.user}
			/>

			<RevokeAccessDialog
				open={revokeAccessDialog.open}
				onOpenChange={(open) =>
					setRevokeAccessDialog({
						open,
						user: open ? revokeAccessDialog.user : null,
					})
				}
				user={revokeAccessDialog.user}
			/>

			<AssignRoleDialog
				open={assignRoleDialog.open}
				onOpenChange={(open) =>
					setAssignRoleDialog({
						open,
						user: open ? assignRoleDialog.user : null,
					})
				}
				user={assignRoleDialog.user}
			/>

			<SendDiscordInviteDialog
				open={sendInviteDialog.open}
				onOpenChange={(open) =>
					setSendInviteDialog({
						open,
						user: open ? sendInviteDialog.user : null,
					})
				}
				user={sendInviteDialog.user}
			/>
		</Card>
	);
}
