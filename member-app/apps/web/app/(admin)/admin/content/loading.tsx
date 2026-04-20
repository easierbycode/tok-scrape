import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function ContentLoading() {
	return (
		<div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
			<Card className="max-w-2xl w-full">
				<div className="p-8 sm:p-12">
					<div className="flex flex-col items-center text-center space-y-6">
						<Skeleton className="h-20 w-20 rounded-2xl" />
						<div className="space-y-2 w-full">
							<Skeleton className="h-8 w-64 mx-auto" />
							<Skeleton className="h-4 w-96 mx-auto" />
						</div>
						<Skeleton className="h-9 w-32 rounded-full" />
						<div className="w-full pt-6">
							<Skeleton className="h-4 w-32 mb-4" />
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{[1, 2, 3, 4].map((i) => (
									<Skeleton
										key={i}
										className="h-20 rounded-lg"
									/>
								))}
							</div>
						</div>
					</div>
				</div>
			</Card>
		</div>
	);
}
