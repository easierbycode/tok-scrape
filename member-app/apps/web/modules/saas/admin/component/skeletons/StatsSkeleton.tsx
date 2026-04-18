import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export function StatsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{Array.from({ length: 4 }, (_, i) => (
				<Card key={`stat-${i}`} className="transition-all duration-150">
					<div className="flex items-center gap-3 p-4">
						<Skeleton className="h-10 w-10 rounded-full" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-6 w-12" />
						</div>
					</div>
				</Card>
			))}
		</div>
	);
}
