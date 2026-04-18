import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function SubscriptionsLoading() {
	return (
		<div className="space-y-6 p-6">
			<Skeleton className="h-10 w-96" />
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{[...Array(6)].map((_, i) => (
					<Card key={i} className="p-6">
						<div className="flex items-center gap-4">
							<Skeleton className="h-12 w-12 rounded-full" />
							<div className="space-y-2">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-8 w-32" />
								<Skeleton className="h-3 w-40" />
							</div>
						</div>
					</Card>
				))}
			</div>
			<Skeleton className="h-[500px] w-full" />
		</div>
	);
}
