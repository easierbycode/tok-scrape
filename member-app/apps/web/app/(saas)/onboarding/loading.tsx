import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function OnboardingLoading() {
	return (
		<div className="flex min-h-screen items-center justify-center p-6">
			<Card className="w-full max-w-xl shadow-overlay">
				<div className="flex flex-col gap-6 p-8">
					<div className="flex items-center justify-between">
						<Skeleton className="h-6 w-32" />
						<div className="flex gap-2">
							<Skeleton className="size-2 rounded-full" />
							<Skeleton className="size-2 rounded-full" />
							<Skeleton className="size-2 rounded-full" />
						</div>
					</div>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-8 w-3/4" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-5/6" />
					</div>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-11 w-full rounded-lg" />
						<Skeleton className="h-11 w-full rounded-lg" />
					</div>
					<div className="flex justify-end gap-3">
						<Skeleton className="h-10 w-24 rounded-lg" />
						<Skeleton className="h-10 w-28 rounded-lg" />
					</div>
				</div>
			</Card>
		</div>
	);
}
