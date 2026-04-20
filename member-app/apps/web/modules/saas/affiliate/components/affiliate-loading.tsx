export function AffiliateLoading() {
	return (
		<div className="container mx-auto px-4 py-8 space-y-6">
			{/* Title skeleton */}
			<div className="space-y-2">
				<div className="h-8 w-64 bg-muted animate-pulse rounded" />
				<div className="h-4 w-96 bg-muted animate-pulse rounded" />
			</div>

			{/* Stats cards skeleton */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="h-32 bg-muted animate-pulse rounded-lg"
					/>
				))}
			</div>

			{/* Pipeline skeleton */}
			<div className="h-64 bg-muted animate-pulse rounded-lg" />
		</div>
	);
}
