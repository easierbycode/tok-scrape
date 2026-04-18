"use client";

import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
	CheckCheck,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Clock,
	Download,
} from "@/modules/ui/icons";
import { exportToCSV, getStatusBadge } from "../lib/utils";

interface Commission {
	id: string;
	date: string | Date;
	customerEmail: string;
	saleAmount: number;
	commission: number;
	status: "paid" | "due" | "pending";
}

export function EarningsTab() {
	const [commissions, setCommissions] = useState<Commission[]>([]);
	const [earnings, setEarnings] = useState<{
		pending: number;
		due: number;
		paid: number;
		total: number;
	} | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState<
		"all" | "paid" | "due" | "pending"
	>("all");
	const itemsPerPage = 10;

	useEffect(() => {
		// TODO: Fetch from Rewardful API when integrated
		// For now, show empty state
		setCommissions([]);
		setEarnings({ pending: 0, due: 0, paid: 0, total: 0 });
		setIsLoading(false);
	}, []);

	// Filter commissions by status
	const filteredCommissions = commissions.filter(
		(c) => statusFilter === "all" || c.status === statusFilter,
	);

	// Reset to page 1 when filter changes
	useEffect(() => {
		setCurrentPage(1);
	}, [statusFilter]);

	const totalPages = Math.ceil(filteredCommissions.length / itemsPerPage);
	const paginatedCommissions = filteredCommissions.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage,
	);

	const handleExport = () => {
		exportToCSV(
			commissions.map((c) => ({
				Date:
					c.date instanceof Date
						? c.date.toLocaleDateString()
						: c.date,
				Customer: c.customerEmail,
				SaleAmount: c.saleAmount,
				Commission: c.commission,
				Status: c.status,
			})),
			"commission-history",
		);
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-32 bg-muted animate-pulse rounded"
						/>
					))}
				</div>
				<div className="h-64 bg-muted animate-pulse rounded" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<h2 className="font-serif font-bold tracking-tight text-2xl">
					Earnings
				</h2>
				<Button variant="outline" size="sm" onClick={handleExport}>
					<Download className="w-4 h-4 mr-2" />
					Export
				</Button>
			</div>

			{/* Earnings Breakdown Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				{/* Pending Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Pending
						</CardTitle>
						<Clock className="h-4 w-4 text-amber-500" />
					</CardHeader>
					<CardContent className="pt-0">
						<div className="text-3xl font-bold text-amber-500">
							$
							{(earnings?.pending ?? 0).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							In refund period
						</p>
					</CardContent>
				</Card>

				{/* Due Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Due
						</CardTitle>
						<CheckCircle className="h-4 w-4 text-green-500" />
					</CardHeader>
					<CardContent className="pt-0">
						<div className="text-3xl font-bold text-green-500">
							$
							{(earnings?.due ?? 0).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Ready for payout
						</p>
					</CardContent>
				</Card>

				{/* Paid Card */}
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Paid
						</CardTitle>
						<CheckCheck className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent className="pt-0">
						<div className="text-3xl font-bold text-muted-foreground">
							$
							{(earnings?.paid ?? 0).toLocaleString("en-US", {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2,
							})}
						</div>
						<p className="text-xs text-muted-foreground mt-2">
							Lifetime earnings
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Commission History Table */}
			<Card>
				<CardHeader>
					<CardTitle>Commission History</CardTitle>
				</CardHeader>
				<CardContent>
					{commissions.length > 0 ? (
						<>
							{/* Filter */}
							<div className="flex items-center gap-4 mb-4">
								<Label htmlFor="status-filter">Status:</Label>
								<Select
									value={statusFilter}
									onValueChange={(value) =>
										setStatusFilter(
											value as
												| "all"
												| "paid"
												| "due"
												| "pending",
										)
									}
								>
									<SelectTrigger
										id="status-filter"
										className="w-[180px]"
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="paid">
											Paid
										</SelectItem>
										<SelectItem value="due">Due</SelectItem>
										<SelectItem value="pending">
											Pending
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b text-sm text-muted-foreground">
											<th className="text-left py-3 px-2">
												Date
											</th>
											<th className="text-left py-3 px-2">
												Customer
											</th>
											<th className="text-right py-3 px-2">
												Sale Amount
											</th>
											<th className="text-right py-3 px-2">
												Your Commission
											</th>
											<th className="text-right py-3 px-2">
												Status
											</th>
										</tr>
									</thead>
									<tbody>
										{paginatedCommissions.map(
											(commission) => (
												<tr
													key={commission.id}
													className="border-b hover:bg-muted/5 transition-colors"
												>
													<td className="py-4 px-2 text-sm">
														{commission.date instanceof
														Date
															? commission.date.toLocaleDateString()
															: commission.date}
													</td>
													<td className="py-4 px-2 text-sm font-mono">
														{
															commission.customerEmail
														}
													</td>
													<td className="py-4 px-2 text-right text-sm text-muted-foreground">
														$
														{commission.saleAmount.toFixed(
															2,
														)}
													</td>
													<td className="py-4 px-2 text-right font-semibold">
														$
														{commission.commission.toFixed(
															2,
														)}
													</td>
													<td className="py-4 px-2 text-right">
														{getStatusBadge(
															commission.status,
														)}
													</td>
												</tr>
											),
										)}
									</tbody>
								</table>
							</div>

							{/* Empty state when filtered */}
							{filteredCommissions.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									No commissions found with the selected
									status.
								</div>
							)}

							{/* Pagination */}
							{totalPages > 1 &&
								filteredCommissions.length > 0 && (
									<div className="flex items-center justify-between mt-6 pt-4 border-t">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage(
													Math.max(
														1,
														currentPage - 1,
													),
												)
											}
											disabled={currentPage === 1}
										>
											<ChevronLeft className="w-4 h-4 mr-2" />
											Previous
										</Button>
										<span className="text-sm text-muted-foreground">
											Page {currentPage} of {totalPages} (
											{filteredCommissions.length} total)
										</span>
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setCurrentPage(
													Math.min(
														totalPages,
														currentPage + 1,
													),
												)
											}
											disabled={
												currentPage === totalPages
											}
										>
											Next
											<ChevronRight className="w-4 h-4 ml-2" />
										</Button>
									</div>
								)}
						</>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							No commission history yet.
						</div>
					)}
				</CardContent>
			</Card>

			{/* Earnings Disclaimer */}
			<p className="text-xs text-muted-foreground text-center">
				Earnings vary based on individual effort and are not guaranteed.{" "}
				<Link
					href="/legal/earnings"
					className="underline hover:text-foreground"
				>
					View Earnings Disclaimer
				</Link>
			</p>
		</div>
	);
}
