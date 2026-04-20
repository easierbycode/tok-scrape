"use client";

import { AdditionalDiscordAccountsList } from "@saas/admin/component/discord/AdditionalDiscordAccountsList";

export default function AdditionalAccountsPage() {
	return (
		<div className="container mx-auto py-8 px-4">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">
					Additional Discord Accounts
				</h1>
				<p className="text-muted-foreground mt-2">
					Manage spouse and family accounts linked to primary
					subscriptions
				</p>
			</div>

			<AdditionalDiscordAccountsList />
		</div>
	);
}
