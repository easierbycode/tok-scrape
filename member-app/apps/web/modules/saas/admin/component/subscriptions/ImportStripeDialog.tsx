"use client";

import { formatCurrency, formatDate } from "@saas/admin/lib/subscription-utils";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload } from "@/modules/ui/icons";

interface ImportStripeDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImported?: () => void;
}

export function ImportStripeDialog({
	open,
	onOpenChange,
	onImported,
}: ImportStripeDialogProps) {
	const queryClient = useQueryClient();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const { data, isLoading, isFetching, refetch } = useQuery({
		...orpc.admin.subscriptions.fetchUnlinked.queryOptions({
			input: undefined,
		}),
		enabled: open,
	});

	useEffect(() => {
		if (open) {
			setSelectedIds(new Set());
		}
	}, [open]);

	const rows = data?.unlinked ?? [];

	const allSelected =
		rows.length > 0 && rows.every((r) => selectedIds.has(r.subscriptionId));

	const handleSelectAll = useCallback(
		(checked: boolean | "indeterminate") => {
			if (checked) {
				setSelectedIds(new Set(rows.map((r) => r.subscriptionId)));
			} else {
				setSelectedIds(new Set());
			}
		},
		[rows],
	);

	const handleRowSelect = useCallback(
		(subscriptionId: string, checked: boolean) => {
			setSelectedIds((prev) => {
				const next = new Set(prev);
				if (checked) {
					next.add(subscriptionId);
				} else {
					next.delete(subscriptionId);
				}
				return next;
			});
		},
		[],
	);

	const selectedRows = useMemo(
		() => rows.filter((r) => selectedIds.has(r.subscriptionId)),
		[rows, selectedIds],
	);

	const importMutation = useMutation(
		orpc.admin.subscriptions.importFromStripe.mutationOptions(),
	);

	const handleImport = async () => {
		if (selectedRows.length === 0) {
			toast.error("Select at least one subscription");
			return;
		}
		const toastId = toast.loading("Importing...");
		try {
			const result = await importMutation.mutateAsync({
				subscriptions: selectedRows.map((r) => ({
					subscriptionId: r.subscriptionId,
					customerId: r.customerId,
					customerEmail: r.customerEmail,
					customerName: r.customerName,
				})),
			});
			toast.success(
				`Imported ${result.imported}${result.skipped ? `, skipped ${result.skipped}` : ""}`,
				{ id: toastId },
			);
			if (result.errors.length > 0) {
				toast.message("Some rows had errors", {
					description: result.errors.slice(0, 8).join("\n"),
				});
			}
			await queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.fetchUnlinked.key(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.admin.subscriptions.overview.key(),
			});
			onImported?.();
			setSelectedIds(new Set());
			await refetch();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Import failed", {
				id: toastId,
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
				<DialogHeader>
					<DialogTitle>Import from Stripe</DialogTitle>
					<DialogDescription>
						Link Stripe subscriptions that do not yet have a
						matching app purchase. No emails are sent; users can
						sign in with a magic link or password reset.
					</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-auto">
					{isLoading || isFetching ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : rows.length === 0 ? (
						<div className="py-8 text-center">
							<p className="text-muted-foreground text-sm">
								No unlinked active Stripe subscriptions found.
							</p>
							{data?.debug && (
								<p className="mt-2 text-muted-foreground text-xs">
									Stripe active: {data.debug.stripeTotal}
									{" / "}Already linked:{" "}
									{data.debug.linkedCount}
									{data.debug.noEmailCount > 0 &&
										` / Skipped (no email): ${data.debug.noEmailCount}`}
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
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Plan</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Period end</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.map((row) => (
										<TableRow key={row.subscriptionId}>
											<TableCell>
												<Checkbox
													checked={selectedIds.has(
														row.subscriptionId,
													)}
													onCheckedChange={(
														checked,
													) =>
														handleRowSelect(
															row.subscriptionId,
															checked === true,
														)
													}
													aria-label={`Select ${row.customerEmail}`}
												/>
											</TableCell>
											<TableCell className="font-medium">
												{row.customerName ?? "—"}
											</TableCell>
											<TableCell className="text-sm">
												{row.customerEmail}
											</TableCell>
											<TableCell className="text-sm">
												{row.plan}
											</TableCell>
											<TableCell className="text-sm">
												{formatCurrency(
													row.amount / 100,
												)}
											</TableCell>
											<TableCell className="text-sm">
												{row.currentPeriodEnd
													? formatDate(
															row.currentPeriodEnd,
														)
													: "—"}
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
						onClick={() => void handleImport()}
						disabled={
							selectedIds.size === 0 || importMutation.isPending
						}
					>
						{importMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Importing...
							</>
						) : (
							<>
								<Upload className="mr-2 h-4 w-4" />
								Import selected
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
