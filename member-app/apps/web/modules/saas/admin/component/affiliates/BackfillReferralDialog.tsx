"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Checkbox } from "@ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, UserPlus } from "@/modules/ui/icons";

const DATE_RANGE_OPTIONS = [
	{ value: "7", label: "Last 7 days" },
	{ value: "30", label: "Last 30 days" },
	{ value: "90", label: "Last 90 days" },
	{ value: "all", label: "All time" },
] as const;

interface BackfillReferralDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onBackfilled?: () => void;
}

export function BackfillReferralDialog({
	open,
	onOpenChange,
	onBackfilled,
}: BackfillReferralDialogProps) {
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [dateRange, setDateRange] = useState<string>("30");
	const [hasScanned, setHasScanned] = useState(false);

	const daysInput = dateRange === "all" ? undefined : Number(dateRange);

	const { data, isLoading, isFetching, refetch } = useQuery({
		...orpc.admin.rewardful.fetchUnattributed.queryOptions({
			input: { days: daysInput },
		}),
		enabled: false,
	});

	useEffect(() => {
		if (open) {
			setSelectedIds(new Set());
			setHasScanned(false);
		}
	}, [open]);

	const handleScan = async () => {
		setSelectedIds(new Set());
		setHasScanned(true);
		await refetch();
	};

	const rows = data?.rows ?? [];

	const allSelected =
		rows.length > 0 && rows.every((r) => selectedIds.has(r.userId));

	const handleSelectAll = useCallback(
		(checked: boolean | "indeterminate") => {
			if (checked) {
				setSelectedIds(new Set(rows.map((r) => r.userId)));
			} else {
				setSelectedIds(new Set());
			}
		},
		[rows],
	);

	const handleRowSelect = useCallback((userId: string, checked: boolean) => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(userId);
			} else {
				next.delete(userId);
			}
			return next;
		});
	}, []);

	const selectedRows = useMemo(
		() => rows.filter((r) => selectedIds.has(r.userId)),
		[rows, selectedIds],
	);

	const backfillMutation = useMutation(
		orpc.admin.rewardful.backfillAttribution.mutationOptions(),
	);

	const handleBackfill = async () => {
		if (selectedRows.length === 0) {
			toast.error("Select at least one row");
			return;
		}
		const toastId = toast.loading("Backfilling attribution...");
		try {
			const result = await backfillMutation.mutateAsync({
				items: selectedRows.map((r) => ({
					userId: r.userId,
					referralId: r.referralId,
					affiliateToken: r.affiliateToken,
				})),
			});
			toast.success(
				`Updated ${result.updatedUsers} users, ${result.updatedPurchases} purchases`,
				{ id: toastId },
			);
			if (result.errors.length > 0) {
				toast.message("Some rows had errors", {
					description: result.errors.slice(0, 8).join("\n"),
				});
			}
			await queryClient.invalidateQueries({
				queryKey: orpc.admin.rewardful.fetchUnattributed.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.admin.analytics.revenue.key(),
			});
			onBackfilled?.();
			setSelectedIds(new Set());
			await refetch();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Backfill failed", {
				id: toastId,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
				<DialogHeader>
					<DialogTitle>Backfill referral attribution</DialogTitle>
					<DialogDescription>
						Matches Rewardful conversion referrals to app users by
						Stripe email (users without{" "}
						<code className="text-xs">referredBySlug</code>). Select
						rows to write referral UUID and affiliate token to the
						database for in-app checkout and analytics.
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center gap-3">
					<span className="text-muted-foreground text-sm">
						Date range:
					</span>
					<Select value={dateRange} onValueChange={setDateRange}>
						<SelectTrigger className="w-[160px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{DATE_RANGE_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						variant="secondary"
						size="sm"
						onClick={() => void handleScan()}
						disabled={isFetching}
					>
						{isFetching ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Search className="mr-2 h-4 w-4" />
						)}
						Scan
					</Button>
				</div>
				<div className="min-h-0 flex-1 overflow-auto">
					{!hasScanned ? (
						<div className="py-8 text-center">
							<p className="text-muted-foreground text-sm">
								Choose a date range and click Scan to find
								unattributed referrals.
							</p>
						</div>
					) : isLoading || isFetching ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : rows.length === 0 ? (
						<div className="py-8 text-center">
							<p className="text-muted-foreground text-sm">
								No unattributed users matched to Rewardful
								conversions.
							</p>
							{data?.totalReferralsScanned != null && (
								<p className="mt-2 text-muted-foreground text-xs">
									Scanned {data.totalReferralsScanned}{" "}
									conversion referrals from Rewardful.
								</p>
							)}
						</div>
					) : (
						<>
							<p className="mb-4 text-muted-foreground text-sm">
								{selectedIds.size} of {rows.length} selected
							</p>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-10">
											<Checkbox
												checked={allSelected}
												onCheckedChange={
													handleSelectAll
												}
												aria-label="Select all"
											/>
										</TableHead>
										<TableHead>User</TableHead>
										<TableHead>Stripe email</TableHead>
										<TableHead>Affiliate token</TableHead>
										<TableHead>Affiliate</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.userId}>
											<TableCell>
												<Checkbox
													checked={selectedIds.has(
														row.userId,
													)}
													onCheckedChange={(
														checked,
													) =>
														handleRowSelect(
															row.userId,
															checked === true,
														)
													}
													aria-label={`Select ${row.stripeEmail}`}
												/>
											</TableCell>
											<TableCell className="font-medium">
												{row.userName}
											</TableCell>
											<TableCell className="text-sm">
												{row.stripeEmail}
											</TableCell>
											<TableCell className="font-mono text-sm">
												{row.affiliateToken}
											</TableCell>
											<TableCell className="text-sm">
												<div>{row.affiliateName}</div>
												<div className="text-muted-foreground text-xs">
													{row.affiliateEmail}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</>
					)}
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="outline"
						type="button"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => void handleBackfill()}
						disabled={
							selectedIds.size === 0 || backfillMutation.isPending
						}
					>
						{backfillMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Backfilling...
							</>
						) : (
							<>
								<UserPlus className="mr-2 h-4 w-4" />
								Backfill selected
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
