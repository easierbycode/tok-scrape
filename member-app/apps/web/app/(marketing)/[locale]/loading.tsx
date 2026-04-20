import { Skeleton } from "@ui/components/skeleton";

export default function MarketingLoading() {
	return (
		<div className="min-h-screen">
			<div className="mx-auto max-w-7xl px-4 pt-24 pb-12 md:px-8 md:pt-32 md:pb-20">
				<div className="flex flex-col items-center gap-6">
					<Skeleton className="h-8 w-48 rounded-full" />
					<Skeleton className="h-12 w-full max-w-2xl rounded-lg" />
					<Skeleton className="h-4 w-full max-w-xl" />
					<Skeleton className="h-4 w-full max-w-md" />
					<div className="mt-4 flex gap-3">
						<Skeleton className="h-11 w-32 rounded-lg" />
						<Skeleton className="h-11 w-32 rounded-lg" />
					</div>
				</div>
			</div>
			<div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }, (_, i) => (
						<Skeleton
							key={`tile-${i}`}
							className="h-48 rounded-xl"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
