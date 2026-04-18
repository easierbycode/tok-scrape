import { Badge } from "@ui/components/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import Link from "next/link";
import {
	AlertTriangle,
	BarChart3,
	FileText,
	MessageSquareText,
	RefreshCw,
	UserPlus,
} from "@/modules/ui/icons";

const sections = [
	{
		icon: MessageSquareText,
		title: "Message Studio",
		description:
			"Build bot messages with embeds and buttons, post or edit in place, save templates",
		href: "/admin/discord/message-studio",
	},
	{
		icon: BarChart3,
		title: "Analytics",
		description: "Monitor Discord connection trends and user behavior",
		href: "/admin/discord/analytics",
	},
	{
		icon: FileText,
		title: "Audit Logs",
		description: "Track all Discord connection and role change history",
		href: "/admin/discord/audit-logs",
	},
	{
		icon: UserPlus,
		title: "Additional Accounts",
		description:
			"Manage spouse and family accounts linked to primary subscriptions",
		href: "/admin/discord/additional-accounts",
	},
	{
		icon: RefreshCw,
		title: "Sync Health Check",
		description:
			"Find and fix discrepancies between Discord server and database",
		href: "/admin/discord/sync-check",
	},
	{
		icon: AlertTriangle,
		title: "Emergency Actions",
		description: "Nuclear options for critical incidents",
		href: "/admin/discord/emergency",
		badge: "Danger",
		badgeStatus: "error" as const,
	},
];

export default function DiscordAdminPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight text-balance">
					Discord Management
				</h1>
				<p className="text-muted-foreground mt-2 text-pretty">
					Manage Discord connections, spouse accounts, audit logs,
					sync health, and emergency controls
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{sections.map((section) => {
					const Icon = section.icon;
					return (
						<Link
							key={section.title}
							href={section.href}
							className="block"
						>
							<Card className="group relative h-full overflow-hidden transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.98]">
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="rounded-lg bg-primary/10 p-2.5">
											<Icon className="h-5 w-5 text-primary" />
										</div>
										{section.badge && (
											<Badge
												status={
													section.badgeStatus ??
													"info"
												}
												className={
													section.badgeStatus ===
													"error"
														? "bg-destructive/20 text-destructive"
														: "bg-primary/20 text-primary"
												}
											>
												{section.badge}
											</Badge>
										)}
									</div>
									<CardTitle className="text-xl">
										{section.title}
									</CardTitle>
									<CardDescription className="text-sm leading-relaxed">
										{section.description}
									</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
