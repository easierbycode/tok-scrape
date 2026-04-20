"use client";

import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { useSession } from "@saas/auth/hooks/use-session";
import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBetaFeature } from "@/lib/hooks/use-beta-feature";
import {
	LinkIcon,
	PlayCircleIcon,
	UserCog2Icon,
	UsersIcon,
} from "@/modules/ui/icons";

export function BottomNav() {
	const pathname = usePathname();
	const { user } = useSession();
	const hasContentAccess = useBetaFeature(
		BETA_FEATURE_IDS.ENHANCED_VIDEO_PLAYER,
	);

	const navItems = [
		{
			label: "Community",
			href: "/app/community",
			icon: UsersIcon,
			isActive: pathname.startsWith("/app/community"),
		},
		...(hasContentAccess
			? [
					{
						label: "Content",
						href: "/app/content",
						icon: PlayCircleIcon,
						isActive: pathname.startsWith("/app/content"),
					},
				]
			: []),
		{
			label: "Affiliate",
			href: "/app/affiliate",
			icon: LinkIcon,
			isActive: pathname.startsWith("/app/affiliate"),
		},
		{
			label: "Settings",
			href: "/app/settings",
			icon: UserCog2Icon,
			isActive: pathname.startsWith("/app/settings"),
		},
	];

	if (!user) {
		return null;
	}

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-background/95 backdrop-blur-md"
			style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
		>
			<div className="flex items-stretch justify-around">
				{navItems.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						prefetch
						className={cn(
							"relative flex flex-1 flex-col items-center gap-1 px-2 pb-2 pt-3 text-xs transition-colors duration-150",
							item.isActive
								? "text-primary"
								: "text-muted-foreground active:text-foreground active:opacity-70",
						)}
					>
						{item.isActive && (
							<span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
						)}
						<item.icon
							className={cn(
								"size-5 shrink-0 transition-colors duration-150",
								item.isActive ? "text-primary" : "opacity-60",
							)}
						/>
						<span className="leading-none">{item.label}</span>
					</Link>
				))}
			</div>
		</nav>
	);
}
