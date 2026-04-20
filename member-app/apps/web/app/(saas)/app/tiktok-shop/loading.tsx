import { Skeleton } from "@ui/components/skeleton";

export default function TiktokShopLoading() {
	return (
		<div className="py-6">
			<div className="mb-8 flex flex-col gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }, (_, i) => (
					<Skeleton key={`stat-${i}`} className="h-24 rounded-xl" />
				))}
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }, (_, i) => (
					<Skeleton
						key={`tile-${i}`}
						className="aspect-[9/16] rounded-xl"
					/>
				))}
			</div>
		</div>
	);
}
