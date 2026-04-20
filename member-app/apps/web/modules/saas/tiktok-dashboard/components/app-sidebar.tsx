"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LogOut, Megaphone, Target, User } from "@/modules/ui/icons";

const navItems = [
	{ href: "/app/tiktok-shop", label: "Dashboard", icon: Home },
	{ href: "/app/tiktok-shop/profile", label: "My Accounts", icon: User },
	{ href: "/app/tiktok-shop/goals", label: "Goals", icon: Target },
	{ href: "/app/tiktok-shop/campaigns", label: "Campaigns", icon: Megaphone },
];

export function AppSidebar() {
	const pathname = usePathname();

	return (
		<aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-background md:flex">
			{/* Logo */}
			<div className="flex h-16 items-center gap-2 border-b border-border px-6">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
					<span className="text-sm font-bold text-primary-foreground">
						L
					</span>
				</div>
				<span className="font-serif font-bold tracking-tight text-lg text-foreground">
					Life
					<span className="text-primary">Preneur</span>
				</span>
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 p-4">
				{navItems.map((item) => {
					const isActive =
						pathname === item.href ||
						(item.href !== "/app/tiktok-shop" &&
							pathname.startsWith(item.href));
					const Icon = item.icon;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
								isActive
									? "bg-primary text-primary-foreground"
									: "text-muted-foreground hover:bg-secondary hover:text-foreground",
							)}
						>
							<Icon className="h-5 w-5" />
							{item.label}
						</Link>
					);
				})}
			</nav>

			{/* User Profile Footer */}
			<div className="border-t border-border p-4">
				<div className="flex items-center gap-3">
					<Avatar className="h-10 w-10 rounded-full">
						<AvatarImage src="" alt="User" />
						<AvatarFallback className="rounded-full bg-secondary text-foreground">
							LP
						</AvatarFallback>
					</Avatar>
					<div className="flex-1 overflow-hidden">
						<p className="truncate text-sm font-medium text-foreground">
							Creator
						</p>
						<p className="truncate text-xs text-muted-foreground">
							creator@example.com
						</p>
					</div>
					<Link
						href="/app/community"
						className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
					>
						<LogOut className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</aside>
	);
}
