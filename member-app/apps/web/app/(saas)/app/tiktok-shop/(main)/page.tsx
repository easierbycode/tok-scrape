import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import { ActiveCampaigns } from "@/modules/saas/tiktok-dashboard/components/active-campaigns";
import { ActiveGoals } from "@/modules/saas/tiktok-dashboard/components/active-goals";
import { ConnectedAccounts } from "@/modules/saas/tiktok-dashboard/components/connected-accounts";
import { DashboardHeader } from "@/modules/saas/tiktok-dashboard/components/dashboard-header";
import { StatsCards } from "@/modules/saas/tiktok-dashboard/components/stats-cards";

export default function TiktokShopHomePage() {
	return (
		<>
			<DashboardHeader title="Dashboard" showSettings />
			<div className="space-y-6 p-4 md:p-6">
				{/* Profile Section - Mobile Only */}
				<section className="flex flex-col items-center text-center md:hidden">
					<Avatar className="h-20 w-20 rounded-full border-2 border-border">
						<AvatarImage src="" alt="Profile" />
						<AvatarFallback className="rounded-full bg-secondary text-2xl text-foreground">
							JD
						</AvatarFallback>
					</Avatar>
					<h2 className="mt-3 font-serif font-bold tracking-tight text-xl text-foreground">
						John Doe
					</h2>
					<p className="text-sm text-muted-foreground">
						@johndoe_creator
					</p>
				</section>

				<StatsCards />
				<ConnectedAccounts />
				<ActiveGoals />
				<ActiveCampaigns />
			</div>
		</>
	);
}
