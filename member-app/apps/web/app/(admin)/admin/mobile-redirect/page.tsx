import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader } from "@ui/components/card";
import Link from "next/link";
import {
	ArrowLeft,
	Bell,
	CreditCard,
	FileText,
	Monitor,
	TrendingUp,
	Users,
} from "@/modules/ui/icons";

export default function MobileRedirectPage() {
	const features = [
		{ icon: Users, label: "User Management" },
		{ icon: CreditCard, label: "Subscriptions" },
		{ icon: Bell, label: "Announcements" },
		{ icon: FileText, label: "Audit Logs" },
		{ icon: TrendingUp, label: "Analytics" },
	];

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-lg border-2">
				<CardHeader className="space-y-6 text-center">
					<div className="mx-auto rounded-full bg-primary/10 p-4">
						<Monitor className="h-12 w-12 text-primary" />
					</div>

					<div className="space-y-2">
						<h1 className="text-2xl font-bold tracking-tight">
							Desktop Required
						</h1>
						<p className="text-balance text-muted-foreground">
							The admin dashboard is optimized for desktop devices
							and requires a larger screen to function properly.
						</p>
					</div>
				</CardHeader>

				<CardContent className="space-y-6">
					<div className="space-y-3">
						<p className="text-sm font-medium">
							Admin Features Available on Desktop:
						</p>
						<div className="grid grid-cols-2 gap-2">
							{features.map((feature) => {
								const Icon = feature.icon;
								return (
									<div
										key={feature.label}
										className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5 text-sm"
									>
										<Icon className="h-4 w-4 text-primary" />
										<span className="text-muted-foreground">
											{feature.label}
										</span>
									</div>
								);
							})}
						</div>
					</div>

					<div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
						<p className="font-medium">Why Desktop Only?</p>
						<p className="text-muted-foreground">
							Complex data tables, filtering systems, and
							management workflows require wider screens for
							optimal usability and productivity.
						</p>
					</div>

					<Link href="/app" className="block">
						<Button className="w-full gap-2" size="lg">
							<ArrowLeft className="h-4 w-4" />
							Back to SaaS Dashboard
						</Button>
					</Link>

					<p className="text-center text-xs text-muted-foreground">
						Access the admin dashboard from a desktop computer with
						a screen width of at least 1024px
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
