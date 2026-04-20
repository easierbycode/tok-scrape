"use client";

import { DropdownMenuSub } from "@radix-ui/react-dropdown-menu";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { Button } from "@ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
	ArrowLeft,
	Bell,
	HardDrive,
	Moon,
	MoreVertical,
	Settings,
	Sun,
} from "@/modules/ui/icons";

interface DashboardHeaderProps {
	title: string;
	showBack?: boolean;
	showSettings?: boolean;
}

const colorModeOptions = [
	{ value: "system", label: "System", icon: HardDrive },
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
] as const;

function ColorModeSubmenu() {
	const t = useTranslations();
	const { setTheme: setCurrentTheme, theme: currentTheme } = useTheme();
	const [theme, setTheme] = useState<string>(currentTheme ?? "system");

	useEffect(() => {
		if (currentTheme) {
			setTheme(currentTheme);
		}
	}, [currentTheme]);

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger>
				<Sun className="mr-2 size-4" />
				{t("app.userMenu.colorMode")}
			</DropdownMenuSubTrigger>
			<DropdownMenuPortal>
				<DropdownMenuSubContent>
					<DropdownMenuRadioGroup
						value={theme}
						onValueChange={(value) => {
							setTheme(value);
							setCurrentTheme(value);
						}}
					>
						{colorModeOptions.map((option) => (
							<DropdownMenuRadioItem
								key={option.value}
								value={option.value}
							>
								<option.icon className="mr-2 size-4 opacity-50" />
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuSubContent>
			</DropdownMenuPortal>
		</DropdownMenuSub>
	);
}

function DashboardHeaderMenuContent({
	showProfileLink,
}: {
	showProfileLink: boolean;
}) {
	return (
		<DropdownMenuContent align="end" className="w-56">
			{showProfileLink && (
				<>
					<DropdownMenuItem asChild>
						<Link href="/app/tiktok-shop/profile">
							<Settings className="mr-2 size-4" />
							Profile &amp; accounts
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
				</>
			)}
			<ColorModeSubmenu />
		</DropdownMenuContent>
	);
}

export function DashboardHeader({
	title,
	showBack = false,
	showSettings = false,
}: DashboardHeaderProps) {
	const router = useRouter();
	const { user } = useSession();

	return (
		<>
			{/* Mobile Header */}
			<header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-lg md:hidden">
				<div className="flex items-center gap-3">
					{showBack && (
						<button
							type="button"
							onClick={() => router.back()}
							className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
						>
							<ArrowLeft className="h-5 w-5" />
							<span className="sr-only">Go back</span>
						</button>
					)}
					<h1 className="text-lg font-semibold text-foreground">
						{title}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="relative h-9 w-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
					>
						<Bell className="h-5 w-5" />
						<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
						<span className="sr-only">Notifications</span>
					</Button>
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
							>
								{showSettings ? (
									<Settings className="h-5 w-5" />
								) : (
									<MoreVertical className="h-5 w-5" />
								)}
								<span className="sr-only">Open menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DashboardHeaderMenuContent
							showProfileLink={showSettings}
						/>
					</DropdownMenu>
				</div>
			</header>

			{/* Desktop Header — avatar opens menu (same pattern as main app header) */}
			<header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm md:flex">
				<h1 className="text-xl font-semibold text-foreground">
					{title}
				</h1>
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="icon"
						className="relative text-muted-foreground hover:bg-secondary hover:text-foreground"
					>
						<Bell className="h-5 w-5" />
						<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
						<span className="sr-only">Notifications</span>
					</Button>
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="relative h-8 w-8 shrink-0 rounded-full p-0 hover:bg-transparent"
							>
								<UserAvatar
									name={user?.name ?? "User"}
									avatarUrl={user?.image}
									className="h-8 w-8"
								/>
								<span className="sr-only">Account menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DashboardHeaderMenuContent showProfileLink />
					</DropdownMenu>
				</div>
			</header>
		</>
	);
}
