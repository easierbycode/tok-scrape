import { Skeleton } from "@ui/components/skeleton";

export default function AffiliateLoading() {
	return (
		<div className="py-6">
			{/* Page header skeleton */}
			<div className="mb-8">
				<Skeleton className="h-8 w-44 rounded-lg" />
				<Skeleton className="mt-2 h-4 w-56 rounded-lg" />
			</div>

			{/* Stats row skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="rounded-lg border p-6 space-y-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-20" />
					</div>
				))}
			</div>

			{/* Link card skeleton */}
			<div className="rounded-lg border p-6 space-y-4">
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-12 w-full rounded-md" />
				<Skeleton className="h-10 w-36 rounded-md" />
			</div>
		</div>
	);
}
