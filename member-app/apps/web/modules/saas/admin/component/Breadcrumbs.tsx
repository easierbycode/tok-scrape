"use client";

import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "@/modules/ui/icons";

const routeMap: Record<string, string> = {
	"/admin": "Dashboard",
	"/admin/users": "Users",
	"/admin/subscriptions": "Subscriptions",
	"/admin/announcements": "Announcements",
	"/admin/announcements/global": "Global Announcements",
	"/admin/audit-log": "Audit Log",
	"/admin/analytics": "Analytics",
	"/admin/command-center": "Command Center",
	"/admin/content": "Content",
	"/admin/affiliates": "Affiliates",
	"/admin/help-center": "Help Center",
	"/admin/help-center/categories": "Categories",
	"/admin/help-center/articles": "Articles",
	"/admin/notifications": "Notifications",
	"/admin/notifications/settings": "Settings",
	"/admin/beta-features": "Beta Features",
	"/admin/testimonials": "Testimonials",
};

export function Breadcrumbs() {
	const pathname = usePathname();

	// Don't show breadcrumbs on dashboard
	if (pathname === "/admin") {
		return null;
	}

	// Build breadcrumb segments from pathname
	const segments = pathname.split("/").filter(Boolean);
	const breadcrumbs: Array<{ path: string; label: string }> = [];

	// Always start with Admin (Dashboard)
	breadcrumbs.push({ path: "/admin", label: "Admin" });

	// Build path segments
	let currentPath = "/admin";
	for (const segment of segments.slice(1)) {
		currentPath += `/${segment}`;
		const label =
			routeMap[currentPath] ||
			segment.charAt(0).toUpperCase() +
				segment.slice(1).replace(/-/g, " ");
		breadcrumbs.push({ path: currentPath, label });
	}

	return (
		<nav aria-label="Breadcrumb" className="mb-4">
			<ol className="flex items-center gap-2 text-sm text-muted-foreground">
				{breadcrumbs.map((crumb, index) => {
					const isLast = index === breadcrumbs.length - 1;

					return (
						<li
							key={crumb.path}
							className="flex items-center gap-2"
						>
							{index > 0 && (
								<ChevronRight
									className="h-4 w-4"
									aria-hidden="true"
								/>
							)}
							{isLast ? (
								<span
									className={cn(
										"font-medium text-foreground",
									)}
									aria-current="page"
								>
									{crumb.label}
								</span>
							) : (
								<Link
									href={crumb.path}
									className="hover:text-foreground transition-colors"
								>
									{index === 0 ? (
										<span className="flex items-center gap-1">
											<Home className="h-3.5 w-3.5" />
											{crumb.label}
										</span>
									) : (
										crumb.label
									)}
								</Link>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
