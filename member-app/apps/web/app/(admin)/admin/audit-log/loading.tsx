import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function AuditLogLoading() {
	return (
		<div className="space-y-6 p-6">
			{/* Header Section */}
			<div>
				<Skeleton className="h-8 w-48" />
				<Skeleton className="mt-1 h-4 w-96" />
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{[...Array(4)].map((_, i) => (
					<Card key={i} className="p-4">
						<div className="flex items-center gap-3">
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="flex-1">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="mt-1 h-5 w-12" />
							</div>
						</div>
					</Card>
				))}
			</div>

			{/* Filters Section */}
			<Card>
				<div className="space-y-3 p-4">
					<div className="flex flex-col gap-3 sm:flex-row">
						<Skeleton className="h-9 flex-1" />
						<Skeleton className="h-9 w-28 shrink-0" />
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<Skeleton className="h-9" />
						<Skeleton className="h-9" />
					</div>
				</div>
			</Card>

			{/* Audit Log Entries */}
			<Card>
				<div className="divide-y divide-border">
					{[...Array(8)].map((_, i) => (
						<div key={i} className="flex items-center gap-3 p-3">
							<Skeleton className="h-4 w-4" />
							<div className="w-32">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="mt-1 h-2 w-28" />
							</div>
							<div className="flex w-40 items-center gap-2">
								<Skeleton className="h-7 w-7 rounded-full" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-6 w-32" />
							<div className="flex-1">
								<Skeleton className="h-3 w-full" />
							</div>
							<Skeleton className="w-28">
								<Skeleton className="h-3 w-20" />
							</Skeleton>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
