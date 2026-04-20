import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function AnnouncementsLoading() {
	return (
		<div className="space-y-6 p-6">
			{/* Header Section */}
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<Skeleton className="mb-2 h-9 w-48" />
						<Skeleton className="h-4 w-64" />
					</div>
					<Skeleton className="h-10 w-48" />
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card className="p-4">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div>
								<Skeleton className="mb-1 h-4 w-20" />
								<Skeleton className="h-7 w-16" />
							</div>
						</div>
					</Card>
					<Card className="p-4">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div>
								<Skeleton className="mb-1 h-4 w-20" />
								<Skeleton className="h-7 w-16" />
							</div>
						</div>
					</Card>
					<Card className="p-4">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div>
								<Skeleton className="mb-1 h-4 w-20" />
								<Skeleton className="h-7 w-16" />
							</div>
						</div>
					</Card>
					<Card className="p-4">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div>
								<Skeleton className="mb-1 h-4 w-20" />
								<Skeleton className="h-7 w-16" />
							</div>
						</div>
					</Card>
				</div>
			</div>

			{/* Filter Controls */}
			<div className="flex flex-col gap-3 sm:flex-row">
				<Skeleton className="h-10 max-w-md flex-1" />
				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-10 w-[120px]" />
					<Skeleton className="h-10 w-[120px]" />
					<Skeleton className="h-10 w-[120px]" />
				</div>
			</div>

			{/* Table Skeleton */}
			<Card>
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead className="border-b border-border">
							<tr>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
								</th>
								<th className="p-4 text-left">
									<Skeleton className="h-4 w-20" />
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
										<div className="flex items-start gap-2">
											<Skeleton className="h-2 w-2 rounded-full" />
											<div>
												<Skeleton className="mb-1 h-4 w-32" />
												<Skeleton className="h-3 w-48" />
											</div>
										</div>
									</td>
									<td className="p-4">
										<Skeleton className="h-5 w-20" />
									</td>
									<td className="p-4">
										<Skeleton className="h-5 w-16" />
									</td>
									<td className="p-4">
										<Skeleton className="h-4 w-12" />
									</td>
									<td className="p-4">
										<Skeleton className="h-4 w-20" />
									</td>
									<td className="p-4">
										<Skeleton className="h-8 w-8" />
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
