import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function AffiliatesLoading() {
	return (
		<div className="space-y-6 p-6">
			{/* Header Section */}
			<div className="flex items-center justify-between">
				<div>
					<Skeleton className="h-8 w-48" />
					<Skeleton className="mt-2 h-4 w-96" />
				</div>
				<Skeleton className="h-10 w-28" />
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i} className="p-6">
						<div className="flex items-center gap-4">
							<Skeleton className="h-12 w-12 rounded-full" />
							<div className="flex-1">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1 h-7 w-16" />
								<Skeleton className="mt-1 h-3 w-20" />
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Search and Filters */}
			<div className="flex flex-col gap-3 sm:flex-row">
				<Skeleton className="h-10 w-full max-w-md" />
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-32" />
				</div>
			</div>

			{/* Affiliates Table */}
			<Card>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="border-b border-border">
							<tr>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-24" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-24" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-16" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-16" />
								</th>
							</tr>
						</thead>
						<tbody>
							{[...Array(5)].map((_, i) => (
								<tr
									key={i}
									className="border-b border-border/50 last:border-b-0"
								>
									<td className="p-4">
										<div className="flex items-center gap-3">
											<Skeleton className="h-10 w-10 rounded-full" />
											<div>
												<Skeleton className="h-4 w-32" />
												<Skeleton className="mt-1 h-3 w-40" />
											</div>
										</div>
									</td>
									<td className="p-4">
										<Skeleton className="h-4 w-24" />
										<Skeleton className="mt-1 h-4 w-28" />
										<Skeleton className="mt-1 h-4 w-20" />
									</td>
									<td className="p-4">
										<Skeleton className="h-5 w-16" />
									</td>
									<td className="p-4">
										<Skeleton className="h-8 w-32" />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Card>
		</div>
	);
}
