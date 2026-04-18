import { Skeleton } from "@ui/components/skeleton";

export default function NotificationsLoading() {
	return (
		<>
			{/* Page header skeleton */}
			<div className="mb-8">
				<Skeleton className="h-8 w-36 rounded-lg" />
				<Skeleton className="mt-2 h-4 w-64 rounded-lg" />
			</div>

			<div className="py-6 space-y-4">
				{Array.from({ length: 5 }, (_, i) => (
					<div key={i} className="rounded-lg border p-6 space-y-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-2 w-2 rounded-full" />
						</div>
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-full" />
					</div>
				))}
			</div>
		</>
	);
}
