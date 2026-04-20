import { Skeleton } from "@ui/components/skeleton";

export default function CommandCenterLoading() {
	return (
		<div className="space-y-6">
			<Skeleton className="h-10 w-72" />
			<Skeleton className="h-32 w-full max-w-md rounded-lg" />
			<div className="grid gap-4 lg:grid-cols-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-56 rounded-lg" />
				))}
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<Skeleton className="h-64 rounded-lg" />
				<Skeleton className="h-64 rounded-lg" />
			</div>
		</div>
	);
}
