"use client";
import { config } from "@repo/config";
import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@ui/lib";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBetaFeature } from "@/lib/hooks/use-beta-feature";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import {
	ChevronRightIcon,
	LayoutIcon,
	LinkIcon,
	PlayCircleIcon,
	UserCog2Icon,
	UsersIcon,
} from "@/modules/ui/icons";
import { OrganzationSelect } from "../../organizations/components/OrganizationSelect";

export function NavBar() {
	const pathname = usePathname();
	const { user } = useSession();

	const { useSidebarLayout } = config.ui.saas;

	const hasContentAccess = useBetaFeature(
		BETA_FEATURE_IDS.ENHANCED_VIDEO_PLAYER,
	);

	// Unread announcements count for the Community sidebar badge
	const { data: announcementsData } = useQuery({
		queryKey: ["community", "announcements", "sidebar-count"],
		queryFn: () => orpcClient.community.announcements.list(),
		staleTime: 60_000,
		gcTime: 5 * 60_000,
		refetchOnWindowFocus: false,
		enabled: !!user && useSidebarLayout,
	});

	const unreadAnnouncements =
		announcementsData?.announcements?.filter(
			(a: { read: boolean }) => !a.read,
		).length ?? 0;

	const menuItems = [
		{
			label: "Dashboard",
			href: "/app/dashboard",
			icon: LayoutIcon,
			isActive: pathname.startsWith("/app/dashboard"),
			badge: 0,
		},
		{
			label: "Community",
			href: "/app/community",
			icon: UsersIcon,
			isActive: pathname.startsWith("/app/community"),
			badge: unreadAnnouncements,
		},
		...(hasContentAccess
			? [
					{
						label: "Content",
						href: "/app/content",
						icon: PlayCircleIcon,
						isActive: pathname.startsWith("/app/content"),
						badge: 0,
					},
				]
			: []),
		{
			label: "Affiliate",
			href: "/app/affiliate",
			icon: LinkIcon,
			isActive: pathname.startsWith("/app/affiliate"),
			badge: 0,
		},
		{
			label: "Settings",
			href: "/app/settings",
			icon: UserCog2Icon,
			isActive: pathname.startsWith("/app/settings"),
			badge: 0,
		},
	];

	return (
		<nav
			className={cn("hidden lg:block w-full", {
				"lg:fixed lg:top-0 lg:left-0 lg:h-full lg:w-[280px]":
					useSidebarLayout,
			})}
		>
			<div
				className={cn("container max-w-6xl py-4", {
					"container max-w-6xl py-4 lg:flex lg:h-full lg:flex-col lg:px-6 lg:pt-6 lg:pb-0":
						useSidebarLayout,
				})}
			>
				{/* Logo row */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div
						className={cn("flex items-center gap-4 lg:gap-2", {
							"lg:flex lg:w-full lg:flex-col lg:items-stretch lg:align-stretch":
								useSidebarLayout,
						})}
					>
						<Link href="/app" className="block">
							<Logo />
						</Link>

						{config.organizations.enable &&
							!config.organizations.hideOrganization && (
								<>
									<span
										className={cn(
											"hidden text-muted-foreground lg:block",
											{
												"lg:hidden": useSidebarLayout,
											},
										)}
									>
										<ChevronRightIcon className="size-4" />
									</span>

									<OrganzationSelect
										className={cn({
											"lg:-mx-2 lg:mt-2":
												useSidebarLayout,
										})}
									/>
								</>
							)}
					</div>

					{/* Top-right user menu for non-sidebar layout */}
					<div
						className={cn(
							"mr-0 ml-auto flex items-center justify-end gap-4",
							{
								"lg:hidden": useSidebarLayout,
							},
						)}
					>
						<UserMenu />
					</div>
				</div>

				{/* Separator between logo and nav items — sidebar only */}
				{useSidebarLayout && (
					<div className="mt-5 border-b border-border/50" />
				)}

				{/* Nav items */}
				<ul
					className={cn(
						"no-scrollbar -mx-4 -mb-4 mt-6 hidden list-none items-center justify-start gap-4 overflow-x-auto px-4 text-sm lg:flex",
						{
							"lg:mx-0 lg:my-3 lg:flex lg:flex-col lg:items-stretch lg:gap-0.5 lg:px-0":
								useSidebarLayout,
						},
					)}
				>
					{menuItems.map((menuItem) => (
						<li key={menuItem.href}>
							<Link
								href={menuItem.href}
								className={cn(
									"flex items-center gap-2 whitespace-nowrap transition-[background-color,color,border-color] duration-150",
									// ── Horizontal tab mode (non-sidebar) ──
									{
										"border-b-2 px-1 py-3":
											!useSidebarLayout,
										"border-primary font-bold text-foreground":
											!useSidebarLayout &&
											menuItem.isActive,
										"border-transparent text-muted-foreground hover:text-foreground hover:border-primary/30 active:opacity-70":
											!useSidebarLayout &&
											!menuItem.isActive,
									},
									// ── Sidebar pill mode ──
									{
										"rounded-lg px-3 py-2.5 gap-3 w-full":
											useSidebarLayout,
										"bg-primary/10 text-primary font-semibold":
											useSidebarLayout &&
											menuItem.isActive,
										"text-muted-foreground hover:bg-muted/60 hover:text-foreground active:opacity-70":
											useSidebarLayout &&
											!menuItem.isActive,
									},
								)}
								prefetch
							>
								<menuItem.icon
									className={cn(
										"size-4 shrink-0 transition-colors duration-150",
										menuItem.isActive
											? "text-primary"
											: "text-muted-foreground",
									)}
								/>
								<span className="flex-1">{menuItem.label}</span>

								{/* Unread badge */}
								{(menuItem.badge ?? 0) > 0 && (
									<span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
										{(menuItem.badge ?? 0) > 99
											? "99+"
											: menuItem.badge}
									</span>
								)}
							</Link>
						</li>
					))}
				</ul>

				{/* Bottom user menu — sidebar only */}
				<div
					className={cn(
						"-mx-4 lg:-mx-6 mt-auto mb-0 hidden p-4 lg:p-4",
						{
							"lg:block": useSidebarLayout,
						},
					)}
				>
					<UserMenu showUserName />
				</div>
			</div>
		</nav>
	);
}
