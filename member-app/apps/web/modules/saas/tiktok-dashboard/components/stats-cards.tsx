import { Calendar, Users, Video } from "@/modules/ui/icons";

const stats = [
	{ label: "Total Followers", value: "124.5K", icon: Users },
	{ label: "Total Videos", value: "342", icon: Video },
	{ label: "Posts This Week", value: "12", icon: Calendar },
];

export function StatsCards() {
	return (
		<div className="rounded-2xl border border-border bg-card p-4 shadow-flat">
			<div className="grid grid-cols-3 divide-x divide-border">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="flex flex-col items-center justify-center px-2 py-2 text-center"
					>
						<span className="text-xl font-bold text-foreground md:text-2xl">
							{stat.value}
						</span>
						<span className="mt-1 text-[10px] text-muted-foreground md:text-xs">
							{stat.label}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
