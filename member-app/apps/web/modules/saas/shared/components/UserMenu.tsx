"use client";

import { DropdownMenuSub } from "@radix-ui/react-dropdown-menu";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuPortal,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
	BellIcon,
	BookIcon,
	HardDriveIcon,
	HomeIcon,
	LogOutIcon,
	MoonIcon,
	MoreVerticalIcon,
	SettingsIcon,
	ShieldIcon,
	SunIcon,
} from "@/modules/ui/icons";

export function UserMenu({ showUserName }: { showUserName?: boolean }) {
	const t = useTranslations();
	const { user } = useSession();
	const { setTheme: setCurrentTheme, theme: currentTheme } = useTheme();
	const [theme, setTheme] = useState<string>(currentTheme ?? "system");

	// Fetch unread notification count — staleTime prevents refetch on every navigation/focus
	const { data: notificationData } = useQuery({
		...orpc.users.notifications.list.queryOptions({
			input: {
				readStatus: "unread",
				dismissed: false,
				limit: 1,
				offset: 0,
			},
		}),
		staleTime: 30_000,
	});

	const unreadCount = notificationData?.stats?.unread || 0;

	const colorModeOptions = [
		{
			value: "system",
			label: "System",
			icon: HardDriveIcon,
		},
		{
			value: "light",
			label: "Light",
			icon: SunIcon,
		},
		{
			value: "dark",
			label: "Dark",
			icon: MoonIcon,
		},
	];

	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					window.location.href = new URL(
						config.auth.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	if (!user) {
		return null;
	}

	const { name, email, image } = user;
	const userWithRole = user as typeof user & { role?: string | null };
	const canOpenAdminNav =
		userWithRole?.role === "admin" ||
		userWithRole?.role === "owner" ||
		userWithRole?.role === "analytics_viewer";

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className="flex cursor-pointer w-full items-center justify-between gap-2 rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-primary md:w-[100%+1rem] md:px-2 md:py-1.5 md:hover:bg-primary/5"
					aria-label="User menu"
				>
					<span className="flex items-center gap-2">
						<span className="relative">
							<UserAvatar name={name ?? ""} avatarUrl={image} />
							{unreadCount > 0 && (
								<span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-2 ring-background" />
							)}
						</span>
						{showUserName && (
							<span className="text-left leading-tight">
								<span className="font-medium text-sm">
									{name}
								</span>
								<span className="block text-muted-foreground text-xs">
									{email}
								</span>
							</span>
						)}
					</span>

					{showUserName && <MoreVerticalIcon className="size-4" />}
				</button>
			</DropdownMenuTrigger>

			<DropdownMenuContent align="end">
				<DropdownMenuLabel>
					{name}
					<span className="block font-normal text-muted-foreground text-xs">
						{email}
					</span>
				</DropdownMenuLabel>

				<DropdownMenuSeparator />

				{canOpenAdminNav && (
					<>
						<DropdownMenuItem asChild>
							<Link href="/admin">
								<ShieldIcon className="mr-2 size-4" />
								Admin Panel
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				)}

				{/* Color mode selection */}
				<DropdownMenuSub>
					<DropdownMenuSubTrigger>
						<SunIcon className="mr-2 size-4" />
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
										<option.icon className="mr-2 size-4 text-muted-foreground" />
										{option.label}
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuSubContent>
					</DropdownMenuPortal>
				</DropdownMenuSub>

				<DropdownMenuSeparator />

				<DropdownMenuItem asChild>
					<Link href="/app/notifications">
						<BellIcon className="mr-2 size-4" />
						Notifications
						{unreadCount > 0 && (
							<span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
								{unreadCount}
							</span>
						)}
					</Link>
				</DropdownMenuItem>

				<DropdownMenuItem asChild>
					<Link href="/app/settings/general">
						<SettingsIcon className="mr-2 size-4" />
						{t("app.userMenu.accountSettings")}
					</Link>
				</DropdownMenuItem>

				<DropdownMenuItem asChild>
					<Link href="/helpcenter">
						<BookIcon className="mr-2 size-4" />
						Help Center
					</Link>
				</DropdownMenuItem>

				<DropdownMenuItem asChild>
					<Link href="/">
						<HomeIcon className="mr-2 size-4" />
						{t("app.userMenu.home")}
					</Link>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={onLogout}>
					<LogOutIcon className="mr-2 size-4" />
					{t("app.userMenu.logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
