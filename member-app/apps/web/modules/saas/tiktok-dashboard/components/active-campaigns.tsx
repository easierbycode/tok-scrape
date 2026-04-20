import { Progress } from "@ui/components/progress";
import Link from "next/link";
import { ChevronRight, Clock, Megaphone } from "@/modules/ui/icons";

const campaigns = [
	{
		id: "1",
		brand: "StyleCo Fashion",
		postsCompleted: 3,
		postsRequired: 5,
		deadline: "3 days left",
	},
	{
		id: "2",
		brand: "TechGear Pro",
		postsCompleted: 2,
		postsRequired: 8,
		deadline: "12 days left",
	},
];

export function ActiveCampaigns() {
	return (
		<section>
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-serif font-bold tracking-tight text-base text-foreground">
					Active Campaigns
				</h2>
				<Link
					href="/app/tiktok-shop/campaigns"
					className="text-sm text-primary hover:underline"
				>
					View all
				</Link>
			</div>
			<div className="space-y-2">
				{campaigns.map((campaign) => {
					const progress = Math.round(
						(campaign.postsCompleted / campaign.postsRequired) *
							100,
					);
					return (
						<Link
							key={campaign.id}
							href="/app/tiktok-shop/campaigns"
							className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-flat transition-[background-color] active:bg-secondary"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
								<Megaphone className="h-5 w-5 text-blue-500" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center justify-between">
									<span className="truncate text-sm font-medium text-foreground">
										{campaign.brand}
									</span>
									<span className="ml-2 flex items-center gap-1 text-xs text-muted-foreground">
										<Clock className="h-3 w-3" />
										{campaign.deadline}
									</span>
								</div>
								<div className="mt-2 flex items-center gap-2">
									<Progress
										value={progress}
										className="h-1.5 flex-1 bg-border [&>div]:bg-blue-500"
									/>
									<span className="text-xs text-muted-foreground">
										{campaign.postsCompleted}/
										{campaign.postsRequired}
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
