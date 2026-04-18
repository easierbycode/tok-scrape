import { EmergencyDiscordActions } from "@saas/admin/component/discord/EmergencyDiscordActions";

export default function EmergencyDiscordPage() {
	return (
		<div className="container mx-auto py-8">
			<div className="mb-6">
				<h1 className="text-3xl font-bold text-destructive">
					Emergency Discord Actions
				</h1>
				<p className="text-muted-foreground">
					SUPER ADMIN ONLY - Use these tools in emergency situations
				</p>
			</div>
			<EmergencyDiscordActions />
		</div>
	);
}
