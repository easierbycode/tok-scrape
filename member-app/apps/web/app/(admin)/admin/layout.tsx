"use client";

import { AdminHeader } from "@saas/admin/component/AdminHeader";
import { AdminSidebar } from "@saas/admin/component/AdminSidebar";
import { Breadcrumbs } from "@saas/admin/component/Breadcrumbs";
import { useAdminContext } from "@saas/admin/lib/admin-context";
import { useSession } from "@saas/auth/hooks/use-session";
import { SidebarProvider } from "@ui/components/sidebar";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { DevToolsPanel } from "@/components/dev-tools-panel";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const [isMobile, setIsMobile] = useState(false);
	const pathname = usePathname();
	const router = useRouter();
	const { user, loaded } = useSession();

	const { isSuperAdmin } = useAdminContext();

	useEffect(() => {
		if (!loaded) {
			return;
		}

		if (!user) {
			router.push("/auth/login");
			return;
		}

		const userRole = (user as { role?: string | null })?.role ?? "user";
		const canAccessAdmin =
			userRole === "owner" ||
			userRole === "admin" ||
			userRole === "analytics_viewer" ||
			isSuperAdmin;

		if (!canAccessAdmin) {
			router.push("/app");
			return;
		}

		if (
			!isSuperAdmin &&
			userRole === "analytics_viewer" &&
			pathname !== "/admin/analytics" &&
			!pathname.startsWith("/admin/analytics/")
		) {
			router.replace("/admin/analytics");
			return;
		}

		if (
			!isSuperAdmin &&
			userRole !== "owner" &&
			(pathname === "/admin/command-center" ||
				pathname.startsWith("/admin/command-center/"))
		) {
			router.replace("/admin");
		}
	}, [user, loaded, router, pathname, isSuperAdmin]);

	useEffect(() => {
		const checkMobile = () => {
			const mobile = window.innerWidth < 1024;
			setIsMobile(mobile);

			// If mobile and not already on the redirect page, redirect
			if (mobile && pathname !== "/admin/mobile-redirect") {
				router.push("/admin/mobile-redirect");
			}
			// If desktop and on redirect page, go to overview
			if (!mobile && pathname === "/admin/mobile-redirect") {
				router.push("/admin");
			}
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, [pathname, router]);

	if (isMobile && pathname !== "/admin/mobile-redirect") {
		return null;
	}

	if (pathname === "/admin/mobile-redirect") {
		return <>{children}</>;
	}

	return (
		<SidebarProvider defaultOpen={false}>
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:outline-none focus:ring-2 focus:ring-primary"
			>
				Skip to main content
			</a>
			<div className="flex min-h-screen w-full bg-background">
				<AdminSidebar />
				<div className="flex flex-1 flex-col">
					<AdminHeader />
					<main
						id="main-content"
						className="flex-1 no-scrollbar p-6 lg:p-8"
					>
						<Breadcrumbs />
						<div className="mt-4">{children}</div>
					</main>
				</div>
			</div>
			<DevToolsPanel />
		</SidebarProvider>
	);
}
