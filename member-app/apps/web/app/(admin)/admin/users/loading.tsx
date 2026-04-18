import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function UsersLoading() {
	return (
		<div className="space-y-6 p-6">
			<div>
				<Skeleton className="h-9 w-32" />
				<Skeleton className="mt-2 h-5 w-96" />
			</div>

			<Card className="p-6">
				<Skeleton className="mb-4 h-8 w-48" />
				<Skeleton className="mb-4 h-10 w-full" />

				<div className="space-y-3">
					{[...Array(8)].map((_, i) => (
						<div
							key={i}
							className="flex items-center gap-4 rounded-lg border p-4"
						>
							<Skeleton className="h-10 w-10 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-3 w-64" />
							</div>
							<Skeleton className="h-8 w-24" />
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
