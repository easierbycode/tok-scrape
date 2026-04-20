"use client";

import { DiscordAuditLogList } from "@saas/admin/component/discord/DiscordAuditLogList";

export default function DiscordAuditLogsPage() {
	return (
		<div className="container mx-auto py-8 px-4">
			<div className="mb-8">
				<h1 className="text-3xl font-bold">Discord Audit Logs</h1>
				<p className="text-muted-foreground mt-2">
					Track all Discord connection and role changes
				</p>
			</div>

			<DiscordAuditLogList />
		</div>
	);
}
