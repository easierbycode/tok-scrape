"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
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
import { useDebounceValue } from "usehooks-ts";
import {
	AlertCircle,
	Bot,
	CheckCircle,
	RefreshCw,
	Shield,
	UserCheck,
	UserX,
	X,
} from "@/modules/ui/icons";

type WhitelistReason = "mod" | "admin" | "test_account";

// ─── Whitelist Dialog ─────────────────────────────────────────────────────────

interface WhitelistDialogProps {
	discordId: string;
	username: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

function WhitelistDialog({
	discordId,
	username,
	open,
	onOpenChange,
	onSuccess,
}: WhitelistDialogProps) {
	const [reason, setReason] = useState<WhitelistReason | "">("");
	const [notes, setNotes] = useState("");
	const [isPending, setIsPending] = useState(false);

	const handleSubmit = async () => {
		if (!reason) {
			return;
		}
		setIsPending(true);
		try {
			await orpcClient.admin.discord.addToWhitelist({
				discordId,
				discordUsername: username,
				reason,
				notes: notes || undefined,
			});
			toast.success(
				`${username} whitelisted — they won't appear in future checks`,
			);
			onSuccess();
			onOpenChange(false);
			setReason("");
			setNotes("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to whitelist user",
			);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5 text-primary" />
						Whitelist Discord User
					</DialogTitle>
					<DialogDescription>
						<strong className="font-mono text-xs text-foreground">
							{username}
						</strong>{" "}
						will be excluded from future sync checks. Use this for
						mods, team members, or test accounts who are
						legitimately in the server without a platform account.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<Label>Reason</Label>
						<Select
							value={reason}
							onValueChange={(v) =>
								setReason(v as WhitelistReason)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a reason" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="mod">Moderator</SelectItem>
								<SelectItem value="admin">
									Admin / Team member
								</SelectItem>
								<SelectItem value="test_account">
									Test account
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Notes (optional)</Label>
						<Input
							placeholder="e.g. Community moderator, friend of the team…"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!reason || isPending}
					>
						{isPending ? "Whitelisting…" : "Whitelist"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Associate Dialog ─────────────────────────────────────────────────────────

interface AssociateDialogProps {
	discordId: string;
	username: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

function AssociateDialog({
	discordId,
	username,
	open,
	onOpenChange,
	onSuccess,
}: AssociateDialogProps) {
	const [search, setSearch] = useState("");
	const [debouncedSearch] = useDebounceValue(search, 300);
	const [selectedUserId, setSelectedUserId] = useState("");
	const [isPending, setIsPending] = useState(false);

	const { data, isLoading } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: {
				searchTerm: debouncedSearch || undefined,
				itemsPerPage: 8,
				currentPage: 1,
			},
		}),
	);

	const handleSubmit = async () => {
		if (!selectedUserId) {
			return;
		}
		setIsPending(true);
		try {
			await orpcClient.admin.users.associateDiscordAccount({
				userId: selectedUserId,
				discordId,
				discordUsername: username,
			});
			toast.success(
				`Discord account linked — ${username} is now associated with the selected user`,
			);
			onSuccess();
			onOpenChange(false);
			setSearch("");
			setSelectedUserId("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to associate account",
			);
		} finally {
			setIsPending(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<UserCheck className="h-5 w-5 text-primary" />
						Associate Discord Account
					</DialogTitle>
					<DialogDescription>
						Link{" "}
						<strong className="font-mono text-xs text-foreground">
							{username}
						</strong>{" "}
						(Discord ID:{" "}
						<span className="font-mono text-xs">{discordId}</span>)
						to an existing platform user. Their Discord fields will
						be updated and the connection logged.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3 py-2">
					<div className="space-y-2">
						<Label>Search for a user</Label>
						<Input
							placeholder="Search by name or email…"
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setSelectedUserId("");
							}}
						/>
					</div>

					{isLoading && (
						<p className="text-sm text-muted-foreground">
							Searching…
						</p>
					)}

					{data?.users && data.users.length > 0 && (
						<div className="rounded-md border divide-y max-h-52 overflow-y-auto">
							{data.users.map((user) => (
								<button
									key={user.id}
									type="button"
									onClick={() => setSelectedUserId(user.id)}
									className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors ${
										selectedUserId === user.id
											? "bg-primary/10 border-l-2 border-l-primary"
											: ""
									}`}
								>
									<div>
										<p className="font-medium">
											{user.name}
										</p>
										<p className="text-muted-foreground text-xs">
											{user.email}
										</p>
									</div>
									{user.discordConnected && (
										<Badge
											status="info"
											className="ml-2 shrink-0"
										>
											Discord linked
										</Badge>
									)}
								</button>
							))}
						</div>
					)}

					{data?.users?.length === 0 && debouncedSearch && (
						<p className="text-sm text-muted-foreground text-center py-4">
							No users found for "{debouncedSearch}"
						</p>
					)}

					{selectedUserId && (
						<p className="text-xs text-muted-foreground bg-muted rounded px-3 py-2">
							If the selected user already has a different Discord
							account linked, it will be replaced.
						</p>
					)}
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={!selectedUserId || isPending}
					>
						{isPending ? "Linking…" : "Link Account"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ─── Whitelist Card (standalone) ──────────────────────────────────────────────

function WhitelistCard() {
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery(
		orpc.admin.discord.getWhitelist.queryOptions(),
	);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const handleRemove = async (discordId: string) => {
		setRemovingId(discordId);
		try {
			await orpcClient.admin.discord.removeFromWhitelist({ discordId });
			toast.success("Removed from whitelist");
			queryClient.invalidateQueries({
				queryKey: orpc.admin.discord.getWhitelist.key(),
			});
		} catch (_error) {
			toast.error("Failed to remove from whitelist");
		} finally {
			setRemovingId(null);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Whitelisted Accounts</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading && (
					<p className="text-sm text-muted-foreground">Loading…</p>
				)}

				{!isLoading &&
					(!data?.whitelist || data.whitelist.length === 0) && (
						<p className="text-sm text-muted-foreground">
							No whitelisted accounts. Users added here are
							excluded from sync checks.
						</p>
					)}

				{data?.whitelist && data.whitelist.length > 0 && (
					<div className="divide-y">
						{data.whitelist.map((entry) => (
							<div
								key={entry.discordId}
								className="flex items-center justify-between py-2.5"
							>
								<div>
									<p className="font-medium text-sm">
										{entry.discordUsername ||
											entry.discordId}
									</p>
									<div className="flex items-center gap-2 mt-0.5">
										<p className="text-xs text-muted-foreground capitalize">
											{entry.reason.replace(/_/g, " ")}
										</p>
										{entry.notes && (
											<span className="text-xs text-muted-foreground">
												· {entry.notes}
											</span>
										)}
									</div>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleRemove(entry.discordId)
									}
									disabled={removingId === entry.discordId}
								>
									<X className="h-3.5 w-3.5 mr-1" />
									Remove
								</Button>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DiscordSyncHealthCheck() {
	const queryClient = useQueryClient();
	const runCheckMutation = useMutation(
		orpc.admin.discord.runSyncHealthCheck.mutationOptions(),
	);
	const kickMutation = useMutation(
		orpc.admin.discord.kickDiscordUser.mutationOptions(),
	);

	const [whitelistDialog, setWhitelistDialog] = useState<{
		open: boolean;
		discordId: string;
		username: string;
	}>({ open: false, discordId: "", username: "" });

	const [associateDialog, setAssociateDialog] = useState<{
		open: boolean;
		discordId: string;
		username: string;
	}>({ open: false, discordId: "", username: "" });

	const runCheck = async () => {
		try {
			const result = await runCheckMutation.mutateAsync({});
			if (result.success) {
				toast.success(
					`Health check complete: ${result.summary?.totalIssues || 0} issues found`,
				);
			} else {
				toast.error(`Health check failed: ${result.error}`);
			}
		} catch (_error) {
			toast.error("Failed to run health check");
		}
	};

	const handleKick = async (discordId: string, username: string) => {
		try {
			await kickMutation.mutateAsync({ discordId, username });
			toast.success(`${username} has been kicked from the server`);
			runCheckMutation.reset();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to kick user",
			);
		}
	};

	const handleResolutionSuccess = () => {
		queryClient.invalidateQueries({
			queryKey: orpc.admin.discord.getWhitelist.key(),
		});
		runCheckMutation.reset();
	};

	const checkData = runCheckMutation.data;

	return (
		<div className="space-y-6">
			{/* Run Check */}
			<Card>
				<CardHeader>
					<CardTitle>Run Sync Check</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<Button
						onClick={runCheck}
						loading={runCheckMutation.isPending}
						disabled={runCheckMutation.isPending}
					>
						<RefreshCw className="mr-2 h-4 w-4" />
						Run Health Check
					</Button>
					<p className="text-xs text-muted-foreground">
						Compares Discord server members against database users
						and flags anyone not accounted for.
					</p>
				</CardContent>
			</Card>

			{/* Results */}
			{checkData?.success && (
				<>
					{/* Summary */}
					<Card>
						<CardHeader>
							<CardTitle>Summary</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
								<div>
									<p className="text-sm text-muted-foreground">
										Total in Server
									</p>
									<p className="text-2xl font-bold">
										{checkData.summary?.totalMembers ?? 0}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground flex items-center gap-1">
										<Bot className="h-3.5 w-3.5" />
										Bots Excluded
									</p>
									<p className="text-2xl font-bold text-muted-foreground">
										{checkData.summary?.botsExcluded ?? 0}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Human Members
									</p>
									<p className="text-2xl font-bold">
										{checkData.summary?.humanMembers ?? 0}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Database Users
									</p>
									<p className="text-2xl font-bold">
										{checkData.summary
											?.totalDatabaseUsers ?? 0}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Issues Found
									</p>
									<p
										className={`text-2xl font-bold ${
											(
												checkData.summary
													?.totalIssues ?? 0
											) > 0
												? "text-rose-500"
												: "text-emerald-500"
										}`}
									>
										{checkData.summary?.totalIssues ?? 0}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Issues */}
					{checkData.issues && checkData.issues.length > 0 ? (
						<Card>
							<CardHeader>
								<CardTitle>Issues Detected</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									{checkData.issues.map((issue, idx) => (
										<div
											key={idx}
											className="flex items-start gap-3 p-3 border rounded-lg"
										>
											<AlertCircle
												className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
													issue.severity === "high"
														? "text-red-500"
														: issue.severity ===
																"medium"
															? "text-yellow-500"
															: "text-blue-500"
												}`}
											/>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 mb-1">
													<Badge
														status={
															issue.severity ===
															"high"
																? "error"
																: issue.severity ===
																		"medium"
																	? "warning"
																	: "info"
														}
													>
														{issue.severity}
													</Badge>
													<span className="text-sm font-medium capitalize">
														{issue.type.replace(
															/_/g,
															" ",
														)}
													</span>
												</div>
												<p className="text-sm text-muted-foreground">
													{issue.message}
												</p>

												{issue.type ===
													"in_discord_not_database" &&
													issue.discordId && (
														<div className="flex flex-wrap gap-2 mt-3">
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	setAssociateDialog(
																		{
																			open: true,
																			discordId:
																				issue.discordId!,
																			username:
																				issue.username ??
																				issue.discordId!,
																		},
																	)
																}
															>
																<UserCheck className="mr-1.5 h-3.5 w-3.5" />
																Associate with
																User
															</Button>
															<Button
																size="sm"
																variant="outline"
																onClick={() =>
																	setWhitelistDialog(
																		{
																			open: true,
																			discordId:
																				issue.discordId!,
																			username:
																				issue.username ??
																				issue.discordId!,
																		},
																	)
																}
															>
																<Shield className="mr-1.5 h-3.5 w-3.5" />
																Whitelist
															</Button>
															<Button
																size="sm"
																variant="error"
																loading={
																	kickMutation.isPending
																}
																onClick={() =>
																	handleKick(
																		issue.discordId!,
																		issue.username ??
																			issue.discordId!,
																	)
																}
															>
																<UserX className="mr-1.5 h-3.5 w-3.5" />
																Kick from Server
															</Button>
														</div>
													)}

												{issue.type ===
													"in_database_not_discord" && (
													<p className="text-xs text-muted-foreground mt-2 italic">
														Ask this user to
														reconnect their Discord
														account from their
														profile settings — they
														may have left the server
														or been removed.
													</p>
												)}
											</div>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					) : (
						<Card>
							<CardContent className="flex items-center justify-center py-12">
								<div className="text-center">
									<CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
									<h3 className="text-lg font-semibold mb-2">
										All Good!
									</h3>
									<p className="text-muted-foreground">
										No sync issues detected
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</>
			)}

			{/* Whitelist — always visible, independent of health check */}
			<WhitelistCard />

			{/* Dialogs */}
			<WhitelistDialog
				discordId={whitelistDialog.discordId}
				username={whitelistDialog.username}
				open={whitelistDialog.open}
				onOpenChange={(open) =>
					setWhitelistDialog((prev) => ({ ...prev, open }))
				}
				onSuccess={handleResolutionSuccess}
			/>
			<AssociateDialog
				discordId={associateDialog.discordId}
				username={associateDialog.username}
				open={associateDialog.open}
				onOpenChange={(open) =>
					setAssociateDialog((prev) => ({ ...prev, open }))
				}
				onSuccess={handleResolutionSuccess}
			/>
		</div>
	);
}
