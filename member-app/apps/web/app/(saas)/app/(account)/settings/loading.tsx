import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

export default function SettingsLoading() {
	return (
		<div className="flex flex-col gap-6 py-6">
			<div className="flex flex-col gap-2">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-4 w-72" />
			</div>
			{Array.from({ length: 3 }, (_, i) => (
				<Card key={`block-${i}`} className="shadow-flat">
					<div className="flex flex-col gap-4 p-6">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-10 w-full rounded-lg" />
						<div className="flex justify-end">
							<Skeleton className="h-10 w-24 rounded-lg" />
						</div>
					</div>
				</Card>
			))}
		</div>
	);
}
