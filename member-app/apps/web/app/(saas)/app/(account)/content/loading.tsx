import { Skeleton } from "@ui/components/skeleton";

export default function ContentLoading() {
	return (
		<div className="py-6">
			{/* Page header skeleton */}
			<div className="mb-8">
				<Skeleton className="h-8 w-44 rounded-lg" />
				<Skeleton className="mt-2 h-4 w-64 rounded-lg" />
			</div>

			{/* Search bar skeleton */}
			<div className="mb-8">
				<Skeleton className="h-12 w-full max-w-md rounded-lg" />
			</div>

			{/* Video rows skeleton */}
			<div className="space-y-8">
				{Array.from({ length: 2 }, (_, i) => (
					<div key={i}>
						<Skeleton className="mb-4 h-6 w-40 rounded-lg" />
						<div className="flex gap-4 overflow-hidden">
							{Array.from({ length: 4 }, (_, j) => (
								<Skeleton
									key={j}
									className="h-36 w-64 flex-shrink-0 rounded-lg"
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
