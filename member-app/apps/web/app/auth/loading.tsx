import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function AuthLoading() {
	return (
		<div className="flex min-h-screen items-center justify-center p-6">
			<Card className="w-full max-w-md shadow-overlay">
				<div className="flex flex-col gap-6 p-8">
					<div className="flex flex-col items-center gap-3">
						<Skeleton className="size-12 rounded-full" />
						<Skeleton className="h-7 w-40" />
						<Skeleton className="h-4 w-56" />
					</div>
					<div className="flex flex-col gap-4">
						<Skeleton className="h-10 w-full rounded-lg" />
						<Skeleton className="h-10 w-full rounded-lg" />
						<Skeleton className="h-10 w-full rounded-lg" />
					</div>
					<Skeleton className="h-4 w-32 self-center" />
				</div>
			</Card>
		</div>
	);
}
