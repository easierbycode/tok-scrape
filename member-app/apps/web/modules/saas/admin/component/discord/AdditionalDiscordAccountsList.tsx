"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Input } from "@ui/components/input";
import { Skeleton } from "@ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { Mail, RefreshCw, UserPlusIcon, XIcon } from "@/modules/ui/icons";

export function AdditionalDiscordAccountsList() {
	const queryClient = useQueryClient();
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearchTerm] = useDebounceValue(searchTerm, 300);
	const [pendingStatusFilter, setPendingStatusFilter] = useState<
		"pending" | "joined" | "expired" | undefined
	>(undefined);

	const { data, isPending, refetch } = useQuery(
		orpc.admin.discord.additionalAccounts.queryOptions({
			input: {
				searchTerm: debouncedSearchTerm || undefined,
				activeOnly: false,
			},
		}),
	);

	const { data: pendingData, isPending: isPendingInvitesLoading } = useQuery(
		orpc.admin.discord.getPendingDiscordInvites.queryOptions({
			input: { status: pendingStatusFilter },
		}),
	);

	const cancelMutation = useMutation(
		orpc.admin.discord.cancelPendingDiscordInvite.mutationOptions(),
	);
	const resendMutation = useMutation(
		orpc.admin.discord.resendDiscordInvite.mutationOptions(),
	);

	const deactivateAccount = async (accountId: string) => {
		try {
			await orpcClient.admin.discord.deactivateAdditionalAccount({
				accountId,
			});
			toast.success("Account deactivated successfully");
			refetch();
		} catch (_error) {
			toast.error("Failed to deactivate account");
		}
	};

	const cancelInvite = async (inviteId: string) => {
		try {
			await cancelMutation.mutateAsync({ inviteId });
			toast.success("Invite cancelled");
			queryClient.invalidateQueries({
				queryKey: orpc.admin.discord.getPendingDiscordInvites.key(),
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to cancel invite",
			);
		}
	};

	const resendInvite = async (inviteId: string) => {
		try {
			await resendMutation.mutateAsync({ inviteId });
			toast.success("Invite resent successfully");
			queryClient.invalidateQueries({
				queryKey: orpc.admin.discord.getPendingDiscordInvites.key(),
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to resend invite",
			);
		}
	};

	return (
		<Card className="p-6">
			<Tabs defaultValue="active">
				<TabsList className="mb-4">
					<TabsTrigger value="active">
						<UserPlusIcon className="mr-2 size-4" />
						Active Accounts
					</TabsTrigger>
					<TabsTrigger value="pending">
						<Mail className="mr-2 size-4" />
						Pending Invites
					</TabsTrigger>
				</TabsList>

				<TabsContent value="active" className="mt-0">
					<div className="mb-4">
						<Input
							placeholder="Search by primary user email or Discord username..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
						/>
					</div>

					{isPending ? (
						<Skeleton className="h-64" />
					) : (
						<div className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Primary User</TableHead>
										<TableHead>Discord</TableHead>
										<TableHead>Relationship</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Added</TableHead>
										<TableHead className="text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data?.accounts.map((account) => (
										<TableRow key={account.id}>
											<TableCell>
												<div>
													<p className="font-medium">
														{
															account.primaryUser
																.name
														}
													</p>
													<p className="text-muted-foreground text-sm">
														{
															account.primaryUser
																.email
														}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<div>
													<p className="font-medium">
														{account.discordUsername ||
															"Unknown"}
													</p>
													<p className="font-mono text-muted-foreground text-xs">
														{account.discordId}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<Badge status="info">
													{account.relationship}
												</Badge>
											</TableCell>
											<TableCell>
												<Badge
													status={
														account.active
															? "success"
															: "error"
													}
												>
													{account.active
														? "Active"
														: "Inactive"}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(
													account.addedAt,
												).toLocaleDateString()}
											</TableCell>
											<TableCell className="text-right">
												{account.active && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															deactivateAccount(
																account.id,
															)
														}
													>
														<XIcon className="mr-1 size-4" />
														Deactivate
													</Button>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							{data?.accounts.length === 0 && (
								<div className="p-8 text-center text-muted-foreground">
									<UserPlusIcon className="mx-auto mb-2 size-12 opacity-20" />
									<p>No additional accounts found</p>
								</div>
							)}
						</div>
					)}
				</TabsContent>

				<TabsContent value="pending" className="mt-0">
					<div className="mb-4 flex gap-2">
						<Button
							variant={
								pendingStatusFilter === undefined
									? "secondary"
									: "outline"
							}
							size="sm"
							onClick={() => setPendingStatusFilter(undefined)}
						>
							All
						</Button>
						<Button
							variant={
								pendingStatusFilter === "pending"
									? "secondary"
									: "outline"
							}
							size="sm"
							onClick={() => setPendingStatusFilter("pending")}
						>
							Pending
						</Button>
						<Button
							variant={
								pendingStatusFilter === "joined"
									? "secondary"
									: "outline"
							}
							size="sm"
							onClick={() => setPendingStatusFilter("joined")}
						>
							Joined
						</Button>
						<Button
							variant={
								pendingStatusFilter === "expired"
									? "secondary"
									: "outline"
							}
							size="sm"
							onClick={() => setPendingStatusFilter("expired")}
						>
							Expired
						</Button>
					</div>

					{isPendingInvitesLoading ? (
						<Skeleton className="h-64" />
					) : (
						<div className="rounded-lg border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Primary User</TableHead>
										<TableHead>Recipient</TableHead>
										<TableHead>Relationship</TableHead>
										<TableHead>Sent</TableHead>
										<TableHead>Expires</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="text-right">
											Actions
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{pendingData?.invites.map((invite) => (
										<TableRow key={invite.id}>
											<TableCell>
												<div>
													<p className="font-medium">
														{
															invite.primaryUser
																.name
														}
													</p>
													<p className="text-muted-foreground text-sm">
														{
															invite.primaryUser
																.email
														}
													</p>
												</div>
											</TableCell>
											<TableCell>
												{invite.recipientEmail}
											</TableCell>
											<TableCell>
												<Badge status="info">
													{invite.relationship}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(
													invite.createdAt,
												).toLocaleDateString()}
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(
													invite.expiresAt,
												).toLocaleDateString()}
											</TableCell>
											<TableCell>
												{invite.status === "expired" ? (
													<Badge className="bg-muted text-muted-foreground">
														{invite.status}
													</Badge>
												) : (
													<Badge
														status={
															invite.status ===
															"pending"
																? "warning"
																: "success"
														}
													>
														{invite.status}
													</Badge>
												)}
											</TableCell>
											<TableCell className="text-right">
												{invite.status ===
													"pending" && (
													<div className="flex justify-end gap-1">
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																resendInvite(
																	invite.id,
																)
															}
															disabled={
																resendMutation.isPending
															}
														>
															<RefreshCw className="mr-1 size-4" />
															Resend
														</Button>
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																cancelInvite(
																	invite.id,
																)
															}
															disabled={
																cancelMutation.isPending
															}
														>
															<XIcon className="mr-1 size-4" />
															Cancel
														</Button>
													</div>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>

							{pendingData?.invites.length === 0 && (
								<div className="p-8 text-center text-muted-foreground">
									<Mail className="mx-auto mb-2 size-12 opacity-20" />
									<p>No pending invites found</p>
								</div>
							)}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</Card>
	);
}
