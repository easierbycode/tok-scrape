"use client";

import { DropdownMenuSub } from "@radix-ui/react-dropdown-menu";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { Button } from "@ui/components/button";
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
import { useSidebar } from "@ui/components/sidebar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
	ArrowLeft,
	Bell,
	BookIcon,
	CreditCard,
	HardDriveIcon,
	Menu,
	MoonIcon,
	Palette,
	SunIcon,
	User,
} from "@/modules/ui/icons";
import { NotificationsDropdown } from "./NotificationsDropdown";

export function AdminHeader() {
	const { toggleSidebar } = useSidebar();
	const { user } = useSession();
	const _router = useRouter();
	const { setTheme: setCurrentTheme, theme: currentTheme } = useTheme();
	const [theme, setTheme] = useState<string>(currentTheme ?? "system");

	const colorModeOptions = [
		{ value: "system", label: "System", icon: HardDriveIcon },
		{ value: "light", label: "Light", icon: SunIcon },
		{ value: "dark", label: "Dark", icon: MoonIcon },
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

	return (
		<header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
			<div className="flex h-16 items-center gap-4 px-6">
				<Button variant="ghost" size="icon" onClick={toggleSidebar}>
					<Menu className="h-5 w-5" />
					<span className="sr-only">Toggle sidebar</span>
				</Button>

				<div className="flex flex-1 items-center gap-4">
					<h2 className="text-lg font-semibold">Admin Console</h2>
				</div>

				<div className="flex items-center gap-2">
					<NotificationsDropdown />

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="h-8 w-8 rounded-full p-0"
							>
								{user?.image ? (
									<UserAvatar
										name={user?.name ?? "Admin"}
										avatarUrl={user?.image}
										className="h-8 w-8"
									/>
								) : (
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
										<User className="h-4 w-4 text-primary" />
									</div>
								)}
								<span className="sr-only">User menu</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel>
								<div className="flex flex-col">
									<span className="text-sm font-medium">
										{user?.name || "Admin User"}
									</span>
									<span className="text-xs text-muted-foreground">
										{user?.email || "admin@lifepreneur.io"}
									</span>
								</div>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />

							<DropdownMenuItem asChild>
								<Link href="/app" className="cursor-pointer">
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back to SaaS Dashboard
								</Link>
							</DropdownMenuItem>

							<DropdownMenuSeparator />

							<DropdownMenuItem asChild>
								<Link href="/app/settings/general">
									<User className="mr-2 h-4 w-4" />
									My Profile
								</Link>
							</DropdownMenuItem>

							{/* Display Settings - Color Mode Submenu */}
							<DropdownMenuSub>
								<DropdownMenuSubTrigger>
									<Palette className="mr-2 h-4 w-4" />
									Display Settings
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

							{/* Notifications */}
							<DropdownMenuItem asChild>
								<Link href="/admin/notifications">
									<Bell className="mr-2 h-4 w-4" />
									Notifications
								</Link>
							</DropdownMenuItem>

							{/* Billing link (if enabled) */}
							{config.users.enableBilling && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link href="/app/settings/billing">
											<CreditCard className="mr-2 h-4 w-4" />
											Billing & Subscription
										</Link>
									</DropdownMenuItem>
								</>
							)}

							<DropdownMenuSeparator />

							{/* Help Center */}
							<DropdownMenuItem asChild>
								<Link href="/helpcenter">
									<BookIcon className="mr-2 h-4 w-4" />
									Help Center
								</Link>
							</DropdownMenuItem>

							<DropdownMenuSeparator />

							{/* Sign Out */}
							<DropdownMenuItem
								className="text-destructive cursor-pointer"
								onClick={onLogout}
							>
								Sign Out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
