import { Skeleton } from "@ui/components/skeleton";

export default function CommunityLoading() {
	return (
		<div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
			{/* Page header skeleton */}
			<div className="mb-8">
				<Skeleton className="h-8 w-48 rounded-lg" />
				<Skeleton className="mt-2 h-4 w-72 rounded-lg" />
			</div>

			{/* Tabs skeleton */}
			<div className="flex gap-2 border-b pb-1 mb-6">
				<Skeleton className="h-10 w-32 rounded-md" />
				<Skeleton className="h-10 w-36 rounded-md" />
			</div>

			{/* Platform card skeleton */}
			<div className="grid gap-4 mb-6">
				<div className="rounded-lg border p-6">
					<div className="flex items-center gap-3 mb-4">
						<Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-5 w-24" />
							<Skeleton className="h-4 w-64" />
						</div>
					</div>
					<Skeleton className="h-10 w-full rounded-md" />
				</div>
			</div>

			{/* Announcement list skeleton */}
			<div className="space-y-4">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="rounded-lg border p-6">
						<div className="flex items-start gap-3">
							<Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-5 w-3/4" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-1/2" />
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
