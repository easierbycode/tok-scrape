import { Skeleton } from "@ui/components/skeleton";

export default function OrganizationLoading() {
	return (
		<>
			{/* Page header skeleton */}
			<div className="mb-8">
				<Skeleton className="h-8 w-48 rounded-lg" />
				<Skeleton className="mt-2 h-4 w-64 rounded-lg" />
			</div>

			{/* Stats grid skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
				{Array.from({ length: 3 }, (_, i) => (
					<div key={i} className="rounded-lg border p-6 space-y-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-16" />
					</div>
				))}
			</div>

			{/* Content area skeleton */}
			<div className="rounded-lg border p-6 space-y-4">
				<Skeleton className="h-6 w-36" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-3/4" />
			</div>
		</>
	);
}
