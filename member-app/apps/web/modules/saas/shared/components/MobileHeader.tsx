"use client";

import { useSession } from "@saas/auth/hooks/use-session";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { UserNotificationsDropdown } from "@saas/shared/components/UserNotificationsDropdown";
import { Logo } from "@shared/components/Logo";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_TITLES: { prefix: string; label: string }[] = [
	{ prefix: "/app/community", label: "Community" },
	{ prefix: "/app/content", label: "Content" },
	{ prefix: "/app/affiliate", label: "Affiliate" },
	{ prefix: "/app/notifications", label: "Notifications" },
	{ prefix: "/app/settings", label: "Settings" },
];

function getPageTitle(pathname: string): string {
	const match = ROUTE_TITLES.find((r) => pathname.startsWith(r.prefix));
	return match?.label ?? "Dashboard";
}

export function MobileHeader() {
	const { user } = useSession();
	const pathname = usePathname();

	if (!user) {
		return null;
	}

	const pageTitle = getPageTitle(pathname);

	return (
		<header
			className="sticky top-0 z-40 lg:hidden flex items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-md px-4"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				minHeight: "calc(3.5rem + env(safe-area-inset-top))",
			}}
		>
			{/* Logo mark — icon only on mobile */}
			<Link href="/app" className="flex items-center shrink-0">
				<Logo withLabel={false} />
			</Link>

			{/* Page title — absolutely centered so it stays centered regardless of action widths */}
			<span className="absolute left-1/2 -translate-x-1/2 text-base font-semibold text-foreground pointer-events-none select-none">
				{pageTitle}
			</span>

			{/* Right actions */}
			<div className="flex items-center gap-0.5 shrink-0">
				<UserNotificationsDropdown />
				<UserMenu />
			</div>
		</header>
	);
}
