"use client";

import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useEffect, useState } from "react";
import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	Download,
	Users,
} from "@/modules/ui/icons";
import { exportToCSV, getStatusBadge } from "../lib/utils";

interface Referral {
	id: string;
	date: string | Date;
	customerEmail: string;
	status: "visitor" | "lead" | "conversion";
	sourceLink: string;
}

export function ReferralsTab() {
	const [referrals, setReferrals] = useState<Referral[]>([]);
	const [currentPage, setCurrentPage] = useState(1);
	const [isLoading, setIsLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState<
		"all" | "visitor" | "lead" | "conversion"
	>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const itemsPerPage = 10;

	useEffect(() => {
		// TODO: Fetch from Rewardful API when integrated
		// For now, show empty state
		setReferrals([]);
		setIsLoading(false);
	}, []);

	// Filter referrals by status and search query
	const filteredReferrals = referrals.filter((r) => {
		const matchesStatus =
			statusFilter === "all" || r.status === statusFilter;
		const matchesSearch =
			!searchQuery ||
			r.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());
		return matchesStatus && matchesSearch;
	});

	// Reset to page 1 when filter changes
	useEffect(() => {
		setCurrentPage(1);
	}, [statusFilter, searchQuery]);

	const totalPages = Math.ceil(filteredReferrals.length / itemsPerPage);
	const paginatedReferrals = filteredReferrals.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage,
	);

	const handleExport = () => {
		exportToCSV(
			referrals.map((r) => ({
				Date:
					r.date instanceof Date
						? r.date.toLocaleDateString()
						: r.date,
				Customer: r.customerEmail,
				Status: r.status,
				SourceLink: r.sourceLink,
			})),
			"referrals",
		);
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				<div className="h-64 bg-muted animate-pulse rounded" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<h2 className="font-serif font-bold tracking-tight text-2xl">
					Referrals
				</h2>
				<Button variant="outline" size="sm" onClick={handleExport}>
					<Download className="w-4 h-4 mr-2" />
					Export
				</Button>
			</div>

			{/* Referrals Table */}
			<Card>
				<CardHeader>
					<CardTitle>Your Referrals</CardTitle>
					<CardDescription>
						View all customers you have referred
					</CardDescription>
				</CardHeader>
				<CardContent>
					{referrals.length > 0 ? (
						<>
							{/* Filters */}
							<div className="flex flex-col sm:flex-row gap-4 mb-4">
								<div className="flex items-center gap-2">
									<Label htmlFor="referral-status-filter">
										Status:
									</Label>
									<Select
										value={statusFilter}
										onValueChange={(value) =>
											setStatusFilter(
												value as
													| "all"
													| "visitor"
													| "lead"
													| "conversion",
											)
										}
									>
										<SelectTrigger
											id="referral-status-filter"
											className="w-[160px]"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">
												All
											</SelectItem>
											<SelectItem value="visitor">
												Visitor
											</SelectItem>
											<SelectItem value="lead">
												Lead
											</SelectItem>
											<SelectItem value="conversion">
												Conversion
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="flex-1">
									<Input
										placeholder="Search by email..."
										value={searchQuery}
										onChange={(e) =>
											setSearchQuery(e.target.value)
										}
									/>
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full">
									<thead>
										<tr className="border-b text-sm text-muted-foreground">
											<th className="text-left py-3 px-2">
												Date
											</th>
											<th className="text-left py-3 px-2">
												Customer Email
											</th>
											<th className="text-left py-3 px-2">
												Status
											</th>
											<th className="text-left py-3 px-2">
												Source Link
											</th>
										</tr>
									</thead>
									<tbody>
										{paginatedReferrals.map((referral) => (
											<tr
												key={referral.id}
												className="border-b hover:bg-muted/5 transition-colors"
											>
												<td className="py-4 px-2 text-sm text-muted-foreground">
													{referral.date instanceof
													Date
														? referral.date.toLocaleDateString()
														: referral.date}
												</td>
												<td className="py-4 px-2 font-mono text-sm">
													{referral.customerEmail}
												</td>
												<td className="py-4 px-2">
													{referral.status ===
														"conversion" && (
														<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-500">
															<CheckCircle className="w-3 h-3" />
															Conversion
														</span>
													)}
													{referral.status ===
														"lead" &&
														getStatusBadge("lead")}
													{referral.status ===
														"visitor" &&
														getStatusBadge(
															"visitor",
														)}
												</td>
												<td className="py-4 px-2 text-sm font-medium">
													{referral.sourceLink}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Empty state when filtered */}
							{filteredReferrals.length === 0 && (
								<div className="text-center py-8 text-muted-foreground">
									{searchQuery || statusFilter !== "all"
										? "No referrals found matching your filters."
										: "No referrals yet."}
								</div>
							)}

							{/* Pagination */}
							{totalPages > 1 && filteredReferrals.length > 0 && (
								<div className="flex items-center justify-between pt-4 border-t mt-6">
									<div className="text-sm text-muted-foreground">
										Showing{" "}
										{(currentPage - 1) * itemsPerPage + 1}{" "}
										to{" "}
										{Math.min(
											currentPage * itemsPerPage,
											filteredReferrals.length,
										)}{" "}
										of {filteredReferrals.length} referrals
									</div>
									<div className="flex items-center gap-2">
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
											<ChevronLeft className="w-4 h-4 mr-1" />
											Previous
										</Button>
										<div className="text-sm text-muted-foreground">
											Page {currentPage} of {totalPages}
										</div>
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
											<ChevronRight className="w-4 h-4 ml-1" />
										</Button>
									</div>
								</div>
							)}
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<Users className="w-12 h-12 text-muted-foreground mb-4" />
							<h3 className="mb-2 font-serif font-semibold tracking-tight text-lg">
								No referrals yet
							</h3>
							<p className="text-sm text-muted-foreground">
								Share your link to start earning!
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
