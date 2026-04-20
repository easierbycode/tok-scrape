import { Skeleton } from "@ui/components/skeleton";

export default function HomeLoading() {
	return (
		<div className="min-h-screen">
			{/* Hero skeleton */}
			<div className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-20 px-4 md:px-8">
				<div className="mx-auto max-w-7xl flex flex-col items-center gap-6 mb-12 md:mb-16">
					<Skeleton className="h-10 w-72 max-w-full rounded-full" />
					<Skeleton className="h-14 w-full max-w-3xl rounded-lg" />
					<Skeleton className="h-24 w-full max-w-2xl rounded-lg" />
					<div className="flex gap-4">
						<Skeleton className="h-12 w-36 rounded-md" />
						<Skeleton className="h-12 w-36 rounded-md" />
					</div>
				</div>
				<div className="flex justify-center">
					<Skeleton className="aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] rounded-[2.5rem]" />
				</div>
			</div>

			{/* Pricing skeleton */}
			<div className="pt-24 pb-12 md:pt-32 md:pb-20">
				<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
					<div className="mb-12 flex flex-col items-center gap-4">
						<Skeleton className="h-8 w-40 rounded-full" />
						<Skeleton className="h-12 w-full max-w-lg rounded-lg" />
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						<Skeleton className="h-96 rounded-lg" />
						<Skeleton className="h-96 rounded-lg" />
						<Skeleton className="h-96 rounded-lg" />
					</div>
				</div>
			</div>
		</div>
	);
}
