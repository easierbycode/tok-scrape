"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertTriangle,
	Calendar,
	ChevronDown,
	ChevronRight,
	Clock,
	DollarSign,
	Download,
	FileText,
	RotateCcw,
	ShieldCheck,
	Users,
} from "@/modules/ui/icons";

export default function PendingDeletionsPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl">Deleted Users</h1>
					<p className="text-muted-foreground">
						Manage deleted users and retained financial records for
						compliance.
					</p>
				</div>
				<Button variant="outline" asChild>
					<Link href="/admin/users">
						<Users className="mr-2 h-4 w-4" />
						Back to Users
					</Link>
				</Button>
			</div>

			<Tabs defaultValue="pending">
				<TabsList>
					<TabsTrigger value="pending">
						<Clock className="mr-2 h-4 w-4" />
						Pending Deletions
					</TabsTrigger>
					<TabsTrigger value="retention">
						<ShieldCheck className="mr-2 h-4 w-4" />
						Financial Retention
					</TabsTrigger>
				</TabsList>

				<TabsContent value="pending">
					<PendingDeletionsTab />
				</TabsContent>
				<TabsContent value="retention">
					<FinancialRetentionTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function PendingDeletionsTab() {
	const queryClient = useQueryClient();
	const { data: pendingUsers, isLoading } = useQuery(
		orpc.admin.users.listPendingDeletions.queryOptions(),
	);

	// Filter to only show non-anonymized users (still in grace period)
	const restorableUsers = pendingUsers?.filter(
		(u) => !u.email.includes("@deleted.local"),
	);

	const handleRestore = async (userId: string) => {
		try {
			await orpcClient.admin.users.restoreUser({ userId });
			toast.success("User restored successfully");
			queryClient.invalidateQueries({
				queryKey:
					orpc.admin.users.listPendingDeletions.queryOptions()
						.queryKey,
			});
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to restore user",
			);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Users in Grace Period</CardTitle>
				<CardDescription>
					These users are in the 30-day grace period. Their data is
					fully preserved and can be restored. After the grace period,
					PII is anonymized and the account is permanently removed.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : !restorableUsers?.length ? (
					<p className="text-muted-foreground">
						No users pending deletion.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Deletion Date</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead>Days Remaining</TableHead>
								<TableHead className="text-right">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{restorableUsers.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div>
											<div className="font-medium">
												{user.name}
											</div>
											<div className="text-muted-foreground text-sm">
												{user.email}
											</div>
										</div>
									</TableCell>
									<TableCell>
										{user.deletedAt
											? new Date(
													user.deletedAt,
												).toLocaleDateString()
											: "-"}
									</TableCell>
									<TableCell>
										<span className="capitalize">
											{user.deletionReason?.replace(
												"_",
												" ",
											) || "-"}
										</span>
									</TableCell>
									<TableCell>
										{user.daysRemaining !== null ? (
											<span
												className={
													user.daysRemaining < 7
														? "font-medium text-destructive"
														: ""
												}
											>
												{user.daysRemaining} days
												{user.daysRemaining < 7 && (
													<AlertTriangle className="ml-1 inline h-4 w-4" />
												)}
											</span>
										) : (
											"-"
										)}
									</TableCell>
									<TableCell className="text-right">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												handleRestore(user.id)
											}
										>
											<RotateCcw className="mr-2 h-4 w-4" />
											Restore
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

function FinancialRetentionTab() {
	const { data: retainedUsers, isLoading } = useQuery(
		orpc.admin.users.listFinancialRetention.queryOptions(),
	);
	const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

	const summaryStats = retainedUsers
		? {
				totalRecords: retainedUsers.length,
				totalRevenue: retainedUsers.reduce(
					(sum, u) => sum + u.totalRevenue,
					0,
				),
				totalPurchases: retainedUsers.reduce(
					(sum, u) => sum + u.purchaseCount,
					0,
				),
				nextExpiry: retainedUsers.reduce(
					(earliest: string | null, u) => {
						if (!u.dataRetentionUntil) {
							return earliest;
						}
						const d = new Date(u.dataRetentionUntil).toISOString();
						return !earliest || d < earliest ? d : earliest;
					},
					null,
				),
			}
		: null;

	const handleExportCsv = () => {
		if (!retainedUsers?.length) {
			return;
		}

		const rows = [
			[
				"User ID",
				"Deleted At",
				"Reason",
				"Retention Until",
				"Purchase Count",
				"Total Revenue (cents)",
				"Purchase Type",
				"Purchase Status",
				"Purchase Amount (cents)",
				"Purchase Interval",
				"Stripe Customer ID",
				"Stripe Subscription ID",
				"Purchase Created At",
			].join(","),
		];

		for (const user of retainedUsers) {
			if (user.purchases.length === 0) {
				rows.push(
					[
						user.id,
						user.deletedAt
							? new Date(user.deletedAt).toISOString()
							: "",
						user.deletionReason || "",
						user.dataRetentionUntil
							? new Date(user.dataRetentionUntil).toISOString()
							: "",
						user.purchaseCount,
						user.totalRevenue,
						"",
						"",
						"",
						"",
						"",
						"",
						"",
					].join(","),
				);
			} else {
				for (const p of user.purchases) {
					rows.push(
						[
							user.id,
							user.deletedAt
								? new Date(user.deletedAt).toISOString()
								: "",
							user.deletionReason || "",
							user.dataRetentionUntil
								? new Date(
										user.dataRetentionUntil,
									).toISOString()
								: "",
							user.purchaseCount,
							user.totalRevenue,
							p.type,
							p.status || "",
							p.cachedAmount || "",
							p.cachedInterval || "",
							p.customerId,
							p.subscriptionId || "",
							new Date(p.createdAt).toISOString(),
						].join(","),
					);
				}
			}
		}

		const csv = rows.join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `financial-retention-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		toast.success("CSV exported successfully");
	};

	return (
		<div className="space-y-4">
			{/* Summary Stats */}
			{summaryStats && retainedUsers && retainedUsers.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
									<Users className="h-5 w-5 text-muted-foreground" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Retained Records
									</p>
									<p className="text-2xl font-semibold">
										{summaryStats.totalRecords}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
									<DollarSign className="h-5 w-5 text-muted-foreground" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Total Revenue Held
									</p>
									<p className="text-2xl font-semibold">
										$
										{(
											summaryStats.totalRevenue / 100
										).toFixed(2)}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
									<FileText className="h-5 w-5 text-muted-foreground" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Total Purchases
									</p>
									<p className="text-2xl font-semibold">
										{summaryStats.totalPurchases}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardContent className="pt-6">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
									<Calendar className="h-5 w-5 text-muted-foreground" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Next Expiry
									</p>
									<p className="text-lg font-semibold">
										{summaryStats.nextExpiry
											? new Date(
													summaryStats.nextExpiry,
												).toLocaleDateString()
											: "N/A"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Retained Financial Records</CardTitle>
							<CardDescription>
								Users whose personal data has been anonymized
								but whose purchase and transaction records are
								retained for the 7-year EU financial compliance
								requirement.
							</CardDescription>
						</div>
						{retainedUsers && retainedUsers.length > 0 && (
							<Button
								variant="outline"
								size="sm"
								onClick={handleExportCsv}
							>
								<Download className="mr-2 h-4 w-4" />
								Export CSV
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<p className="text-muted-foreground">Loading...</p>
					) : !retainedUsers?.length ? (
						<p className="text-muted-foreground">
							No retained financial records.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-8" />
									<TableHead>User ID</TableHead>
									<TableHead>Deleted</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead>Purchases</TableHead>
									<TableHead>Revenue</TableHead>
									<TableHead>Retention Expires</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{retainedUsers.map((user) => (
									<>
										<TableRow
											key={user.id}
											className="cursor-pointer hover:bg-muted/50"
											onClick={() =>
												setExpandedUserId(
													expandedUserId === user.id
														? null
														: user.id,
												)
											}
										>
											<TableCell>
												{expandedUserId === user.id ? (
													<ChevronDown className="h-4 w-4 text-muted-foreground" />
												) : (
													<ChevronRight className="h-4 w-4 text-muted-foreground" />
												)}
											</TableCell>
											<TableCell>
												<code className="text-xs bg-muted px-1.5 py-0.5 rounded">
													{user.id.slice(0, 12)}...
												</code>
											</TableCell>
											<TableCell>
												{user.deletedAt
													? new Date(
															user.deletedAt,
														).toLocaleDateString()
													: "-"}
											</TableCell>
											<TableCell>
												<span className="capitalize">
													{user.deletionReason?.replace(
														"_",
														" ",
													) || "-"}
												</span>
											</TableCell>
											<TableCell>
												{user.purchaseCount}
											</TableCell>
											<TableCell>
												$
												{(
													user.totalRevenue / 100
												).toFixed(2)}
											</TableCell>
											<TableCell>
												{user.daysUntilExpiry !==
												null ? (
													<span className="flex items-center gap-1">
														{user.dataRetentionUntil
															? new Date(
																	user.dataRetentionUntil,
																).toLocaleDateString()
															: "-"}
														<span className="text-xs text-muted-foreground">
															(
															{Math.floor(
																(user.daysUntilExpiry ??
																	0) / 365,
															)}
															y{" "}
															{Math.floor(
																((user.daysUntilExpiry ??
																	0) %
																	365) /
																	30,
															)}
															m)
														</span>
													</span>
												) : (
													"-"
												)}
											</TableCell>
										</TableRow>
										{expandedUserId === user.id && (
											<TableRow key={`${user.id}-detail`}>
												<TableCell
													colSpan={7}
													className="bg-muted/30 p-0"
												>
													<div className="px-8 py-4 space-y-3">
														<h4 className="text-sm font-medium">
															Purchase History
														</h4>
														{user.purchases
															.length === 0 ? (
															<p className="text-sm text-muted-foreground">
																No purchases on
																record.
															</p>
														) : (
															<Table>
																<TableHeader>
																	<TableRow>
																		<TableHead>
																			Type
																		</TableHead>
																		<TableHead>
																			Status
																		</TableHead>
																		<TableHead>
																			Amount
																		</TableHead>
																		<TableHead>
																			Interval
																		</TableHead>
																		<TableHead>
																			Coupon
																		</TableHead>
																		<TableHead>
																			Stripe
																			Customer
																		</TableHead>
																		<TableHead>
																			Created
																		</TableHead>
																	</TableRow>
																</TableHeader>
																<TableBody>
																	{user.purchases.map(
																		(p) => (
																			<TableRow
																				key={
																					p.id
																				}
																			>
																				<TableCell className="capitalize">
																					{p.type.toLowerCase()}
																				</TableCell>
																				<TableCell>
																					{p.status ||
																						"-"}
																				</TableCell>
																				<TableCell>
																					{p.cachedAmount
																						? `$${(p.cachedAmount / 100).toFixed(2)}`
																						: "-"}
																				</TableCell>
																				<TableCell className="capitalize">
																					{p.cachedInterval ||
																						"-"}
																				</TableCell>
																				<TableCell>
																					{p.cachedCouponName
																						? `${p.cachedCouponName}${p.cachedDiscountPercent ? ` (${p.cachedDiscountPercent}%)` : ""}`
																						: "-"}
																				</TableCell>
																				<TableCell>
																					<code className="text-xs bg-muted px-1.5 py-0.5 rounded">
																						{
																							p.customerId
																						}
																					</code>
																				</TableCell>
																				<TableCell>
																					{new Date(
																						p.createdAt,
																					).toLocaleDateString()}
																				</TableCell>
																			</TableRow>
																		),
																	)}
																</TableBody>
															</Table>
														)}

														<div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
															<span>
																Deleted by:{" "}
																{user.deletedBy ||
																	"Unknown"}
															</span>
															<span>
																Deleted:{" "}
																{user.deletedAt
																	? new Date(
																			user.deletedAt,
																		).toLocaleString()
																	: "-"}
															</span>
															<span>
																Retention until:{" "}
																{user.dataRetentionUntil
																	? new Date(
																			user.dataRetentionUntil,
																		).toLocaleString()
																	: "-"}
															</span>
														</div>
													</div>
												</TableCell>
											</TableRow>
										)}
									</>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
