"use client";

import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { IconType } from "@/modules/ui/icons";
import {
	ChartBarIcon,
	GridFourIcon,
	Icon,
	TargetIcon,
	UserIcon,
} from "@/modules/ui/icons";

const navItems: Array<{
	href: string;
	label: string;
	icon: IconType;
}> = [
	{ href: "/app/tiktok-shop", label: "Home", icon: GridFourIcon },
	{
		href: "/app/tiktok-shop/campaigns",
		label: "Campaigns",
		icon: ChartBarIcon,
	},
	{ href: "/app/tiktok-shop/goals", label: "Goals", icon: TargetIcon },
	{ href: "/app/tiktok-shop/profile", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
	const pathname = usePathname();

	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-lg md:hidden">
			<div className="flex h-16 items-center justify-around px-2">
				{navItems.map((item) => {
					const isActive =
						pathname === item.href ||
						(item.href !== "/app/tiktok-shop" &&
							pathname.startsWith(item.href));

					return (
						<Link
							key={item.href}
							href={item.href}
							className="flex flex-col items-center justify-center gap-1"
						>
							<div
								className={cn(
									"flex h-10 w-10 items-center justify-center rounded-full transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground",
								)}
							>
								<Icon
									icon={item.icon}
									size={20}
									weight={isActive ? "fill" : "regular"}
								/>
							</div>
							<span
								className={cn(
									"text-[10px] font-medium",
									isActive
										? "text-primary"
										: "text-muted-foreground",
								)}
							>
								{item.label}
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
