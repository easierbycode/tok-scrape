import { canAccessCommandCenter } from "@repo/api/lib/roles";
import { getSession } from "@saas/auth/lib/server";
import { Badge } from "@ui/components/badge";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
	Beaker,
	Bell,
	CreditCard,
	DollarSign,
	FileText,
	LayoutDashboard,
	Megaphone,
	TrendingUp,
	Users,
	Video,
} from "@/modules/ui/icons";

interface DashboardSection {
	icon: typeof Users;
	title: string;
	description: string;
	href: string;
	badge?: string;
}

export default async function AdminDashboardPage() {
	const session = await getSession();
	if (!session?.user) {
		redirect("/auth/login");
	}

	const t = await getTranslations();

	const { checkIsSuperAdmin } = await import("@saas/admin/lib/super-admin");
	const isSuperAdmin = checkIsSuperAdmin(session.user.email);
	const role = session.user.role ?? "user";
	const isAnalyticsViewerOnly = role === "analytics_viewer" && !isSuperAdmin;
	const showCommandCenter = canAccessCommandCenter(role, isSuperAdmin);

	const commandCenterSection: DashboardSection = {
		icon: LayoutDashboard,
		title: "Command Center",
		description:
			"Owner snapshot: watchlists, cron signals, Stripe webhooks, and MRR",
		href: "/admin/command-center",
	};

	const coreSections: DashboardSection[] = [
		{
			icon: Users,
			title: t("admin.menu.users"),
			description:
				"User management, permissions, roles, and account administration",
			href: "/admin/users",
		},
		{
			icon: CreditCard,
			title: t("admin.menu.subscriptions"),
			description:
				"Manage subscriptions, billing cycles, plans, and payment processing",
			href: "/admin/subscriptions",
		},
		{
			icon: Bell,
			title: t("admin.menu.announcements"),
			description:
				"Create and manage platform announcements and notifications",
			href: "/admin/announcements",
		},
		{
			icon: DollarSign,
			title: t("admin.menu.affiliates"),
			description:
				"Affiliate program management, tracking, and commission reports",
			href: "/admin/affiliates",
		},
		{
			icon: Video,
			title: t("admin.menu.content"),
			description:
				"Content management system for platform resources and media",
			badge: "Coming Soon",
			href: "/admin/content",
		},
		{
			icon: TrendingUp,
			title: t("admin.menu.analytics"),
			description:
				"Advanced analytics, insights, and performance metrics",
			href: "/admin/analytics",
		},
		{
			icon: FileText,
			title: t("admin.menu.auditLog"),
			description:
				"Security audit log, activity tracking, and compliance monitoring",
			href: "/admin/audit-log",
		},
		{
			icon: Beaker,
			title: "Beta Features",
			description:
				"Private beta testing for new features - manage testers and feature access",
			href: "/admin/beta-features",
		},
		{
			icon: Megaphone,
			title: "Marketing",
			description:
				"Manage homepage content, hero section, SEO settings, FAQs, and testimonials for the marketing team",
			href: "/admin/marketing",
		},
	];

	const analyticsOnlySection: DashboardSection = {
		icon: TrendingUp,
		title: t("admin.menu.analytics"),
		description: "Advanced analytics, insights, and performance metrics",
		href: "/admin/analytics",
	};

	const sections: DashboardSection[] = isAnalyticsViewerOnly
		? [analyticsOnlySection]
		: [
				...(showCommandCenter ? [commandCenterSection] : []),
				...coreSections,
			];

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-serif text-3xl font-semibold tracking-tight text-balance">
					{t("admin.dashboard.title")}
				</h1>
				<p className="text-muted-foreground mt-2 text-pretty">
					{t("admin.dashboard.subtitle")}
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{sections.map((section) => {
					const Icon = section.icon;
					return (
						<Link
							key={section.href + section.title}
							href={section.href}
							className="block"
						>
							<Card className="group shadow-flat relative h-full overflow-hidden transition-[box-shadow,border-color,transform] hover:border-primary/50 hover:shadow-raised active:scale-[0.98] active:shadow-flat">
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="rounded-lg bg-primary/10 p-2.5 shadow-inset-subtle">
											<Icon className="h-5 w-5 text-primary" />
										</div>
										{section.badge && (
											<Badge
												status="info"
												className="bg-primary/20 text-primary"
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
