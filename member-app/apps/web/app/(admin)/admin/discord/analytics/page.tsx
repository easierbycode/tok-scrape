import { DiscordAnalyticsDashboard } from "@saas/admin/component/discord/DiscordAnalyticsDashboard";

export default function DiscordAnalyticsPage() {
	return (
		<div className="container mx-auto py-8">
			<div className="mb-6">
				<h1 className="text-3xl font-bold">Discord Analytics</h1>
				<p className="text-muted-foreground">
					Monitor Discord connection trends and user behavior
				</p>
			</div>
			<DiscordAnalyticsDashboard />
		</div>
	);
}
