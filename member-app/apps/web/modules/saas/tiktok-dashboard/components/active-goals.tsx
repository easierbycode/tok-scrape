import { Progress } from "@ui/components/progress";
import Link from "next/link";
import { ChevronRight, Target } from "@/modules/ui/icons";

const goals = [
	{ id: "1", name: "Daily Posting Streak", current: 5, target: 7 },
	{ id: "2", name: "Weekly Content Goal", current: 8, target: 14 },
];

export function ActiveGoals() {
	return (
		<section>
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-serif font-bold tracking-tight text-base text-foreground">
					Active Goals
				</h2>
				<Link
					href="/app/tiktok-shop/goals"
					className="text-sm text-primary hover:underline"
				>
					View all
				</Link>
			</div>
			<div className="space-y-2">
				{goals.map((goal) => {
					const progress = Math.round(
						(goal.current / goal.target) * 100,
					);
					return (
						<Link
							key={goal.id}
							href="/app/tiktok-shop/goals"
							className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-flat transition-[background-color] active:bg-secondary"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Target className="h-5 w-5 text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between">
									<span className="text-sm font-medium text-foreground">
										{goal.name}
									</span>
									<span className="ml-2 text-sm font-semibold text-primary">
										{progress}%
									</span>
								</div>
								<div className="mt-2 flex items-center gap-2">
									<Progress
										value={progress}
										className="h-1.5 flex-1 bg-border [&>div]:bg-primary"
									/>
									<span className="text-xs text-muted-foreground">
										{goal.current}/{goal.target}
									</span>
								</div>
							</div>
							<ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
						</Link>
					);
				})}
			</div>
		</section>
	);
}
