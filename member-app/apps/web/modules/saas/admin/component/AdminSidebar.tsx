"use client";

import { canAccessCommandCenter } from "@repo/api/lib/roles";
import { useAdminContext } from "@saas/admin/lib/admin-context";
import { useSession } from "@saas/auth/hooks/use-session";
import { Badge } from "@ui/components/badge";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@ui/components/sidebar";
import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
	BarChart3,
	Beaker,
	Bell,
	Construction,
	CreditCard,
	DollarSign,
	FileText,
	HelpCircle,
	LayoutDashboard,
	Megaphone,
	MessageSquare,
	Trash2,
	TrendingUp,
	Users,
	Video,
} from "@/modules/ui/icons";

function HealthIndicator() {
	const [status, setStatus] = useState<"healthy" | "unhealthy" | "checking">(
		"checking",
	);

	useEffect(() => {
		async function check() {
			try {
				const res = await fetch("/api/health");
				setStatus(res.ok ? "healthy" : "unhealthy");
			} catch {
				setStatus("unhealthy");
			}
		}

		check();
		const interval = setInterval(check, 60000); // Every 60 seconds
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
			<div
				className={cn(
					"h-2 w-2 rounded-full",
					status === "healthy" && "bg-green-500",
					status === "unhealthy" && "animate-pulse bg-red-500",
					status === "checking" && "bg-yellow-500",
				)}
			/>
			<span>
				{status === "healthy"
					? "System Healthy"
					: status === "checking"
						? "Checking..."
						: "Issues Detected"}
			</span>
		</div>
	);
}

export function AdminSidebar() {
	const t = useTranslations();
	const pathname = usePathname();
	const { setOpen, setOpenMobile } = useSidebar();
	const prevPathnameRef = useRef(pathname);
	const { user } = useSession();

	const { isSuperAdmin } = useAdminContext();
	const role = (user as { role?: string | null })?.role ?? "user";
	const isAnalyticsViewerOnly = role === "analytics_viewer" && !isSuperAdmin;
	const showCommandCenter = canAccessCommandCenter(role, isSuperAdmin);

	const allMenuItems = [
		...(showCommandCenter
			? [
					{
						title: "Command Center",
						icon: LayoutDashboard,
						href: "/admin/command-center",
					},
				]
			: []),
		{
			title: t("admin.menu.overview"),
			icon: BarChart3,
			href: "/admin",
		},
		{
			title: t("admin.menu.users"),
			icon: Users,
			href: "/admin/users",
		},
		{
			title: "Deleted Users",
			icon: Trash2,
			href: "/admin/users/pending-deletions",
		},
		{
			title: "Discord",
			icon: MessageSquare,
			href: "/admin/discord",
		},
		{
			title: "Maintenance",
			icon: Construction,
			href: "/admin/maintenance",
		},
		{
			title: t("admin.menu.subscriptions"),
			icon: CreditCard,
			href: "/admin/subscriptions",
		},
		{
			title: t("admin.menu.announcements"),
			icon: Bell,
			href: "/admin/announcements",
		},
		{
			title: "Global Announcements",
			icon: Bell,
			href: "/admin/announcements/global",
		},
		{
			title: t("admin.menu.affiliates"),
			icon: DollarSign,
			href: "/admin/affiliates",
		},
		{
			title: t("admin.menu.content"),
			icon: Video,
			href: "/admin/content",
			badge: "Soon",
		},
		{
			title: t("admin.menu.analytics"),
			icon: TrendingUp,
			href: "/admin/analytics",
		},
		{
			title: t("admin.menu.auditLog"),
			icon: FileText,
			href: "/admin/audit-log",
		},
		{
			title: "Beta Features",
			icon: Beaker,
			href: "/admin/beta-features",
		},
		{
			title: "Help Center",
			icon: HelpCircle,
			href: "/admin/help-center",
		},
		{
			title: "Marketing",
			icon: Megaphone,
			href: "/admin/marketing",
		},
	];

	const menuItems = isAnalyticsViewerOnly
		? allMenuItems.filter((item) => item.href === "/admin/analytics")
		: allMenuItems;

	const adminHomeHref = isAnalyticsViewerOnly ? "/admin/analytics" : "/admin";

	// Close sidebar on navigation (both mobile and desktop)
	useEffect(() => {
		// Only close if pathname actually changed (not on initial render or sidebar toggle)
		if (prevPathnameRef.current !== pathname) {
			setOpen(false);
			setOpenMobile(false);
			prevPathnameRef.current = pathname;
		}
	}, [pathname, setOpen, setOpenMobile]);

	return (
		<Sidebar>
			<SidebarHeader className="border-b border-sidebar-border px-4 py-4">
				<Link href={adminHomeHref} className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
						<BarChart3 className="h-5 w-5 text-primary-foreground" />
					</div>
					<div className="flex flex-col">
						<span className="text-sm font-semibold text-sidebar-foreground">
							Admin Console
						</span>
						<span className="text-xs text-muted-foreground">
							Platform Management
						</span>
					</div>
				</Link>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{menuItems.map((item, index) => (
								<SidebarMenuItem key={`${item.href}-${index}`}>
									<SidebarMenuButton
										asChild
										isActive={
											pathname === item.href ||
											pathname.startsWith(`${item.href}/`)
										}
									>
										<Link
											href={item.href}
											className="flex items-center gap-3"
										>
											<item.icon className="h-4 w-4" />
											<span>{item.title}</span>
											{item.badge && (
												<Badge
													status="info"
													className="ml-auto text-xs"
												>
													{item.badge}
												</Badge>
											)}
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t border-sidebar-border p-4">
				<HealthIndicator />
				<div className="text-xs text-muted-foreground">
					<p>LifePreneur v1.0.0</p>
					<p className="mt-1">© 2025 LifePreneur</p>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
