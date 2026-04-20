import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";

interface TableSkeletonProps {
	rows?: number;
	columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 6 }: TableSkeletonProps) {
	return (
		<Card>
			<div className="overflow-x-auto">
				<table className="w-full">
					<thead className="border-b border-border">
						<tr>
							{Array.from({ length: columns }, (_, i) => (
								<th
									key={`header-${i}`}
									className="p-4 text-left"
								>
									<Skeleton className="h-4 w-24" />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{Array.from({ length: rows }, (_, i) => (
							<tr
								key={`row-${i}`}
								className="border-b border-border last:border-b-0"
							>
								{Array.from({ length: columns }, (_, j) => (
									<td key={`cell-${i}-${j}`} className="p-4">
										<Skeleton className="h-4 w-full max-w-[200px]" />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
