"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@ui/components/avatar";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import Link from "next/link";
import { useState } from "react";
import { DashboardHeader } from "@/modules/saas/tiktok-dashboard/components/dashboard-header";
import { TikTokIcon } from "@/modules/saas/tiktok-dashboard/components/tiktok-icon";
import {
	ChevronRight,
	LogOut,
	Pencil,
	Plus,
	Settings,
	Users,
} from "@/modules/ui/icons";

interface AccountItem {
	id: string;
	username: string;
	avatar: string;
	followers: string;
	videos: number;
	likes: string;
	nickname: string;
	nicknameColor: string;
}

const initialAccounts: AccountItem[] = [
	{
		id: "1",
		username: "@creativejane",
		avatar: "",
		followers: "85.2K",
		videos: 234,
		likes: "1.2M",
		nickname: "Main Account",
		nicknameColor: "bg-primary",
	},
	{
		id: "2",
		username: "@janecreates",
		avatar: "",
		followers: "39.3K",
		videos: 108,
		likes: "542K",
		nickname: "Beauty",
		nicknameColor: "bg-blue-500",
	},
	{
		id: "3",
		username: "@janelifestyle",
		avatar: "",
		followers: "12.8K",
		videos: 45,
		likes: "89K",
		nickname: "Lifestyle",
		nicknameColor: "bg-success",
	},
];

const menuItems = [
	{
		label: "Personal Information",
		icon: Users,
		href: "/app/settings",
	},
	{
		label: "Payment Preferences",
		icon: Settings,
		href: "/app/settings/billing",
	},
	{
		label: "Notifications",
		icon: Settings,
		href: "/app/settings",
		badge: 2,
	},
];

export default function ProfilePage() {
	const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editNickname, setEditNickname] = useState("");

	function handleEditNickname(id: string, currentNickname: string) {
		setEditingId(id);
		setEditNickname(currentNickname);
	}

	function handleSaveNickname(id: string) {
		setAccounts(
			accounts.map((acc) =>
				acc.id === id ? { ...acc, nickname: editNickname } : acc,
			),
		);
		setEditingId(null);
		setEditNickname("");
	}

	return (
		<>
			<DashboardHeader title="Profile" showBack />
			<div className="p-4 md:p-6">
				{/* Profile Header */}
				<section className="mb-6 flex flex-col items-center text-center">
					<Avatar className="h-24 w-24 rounded-full border-2 border-border">
						<AvatarImage src="" alt="Profile" />
						<AvatarFallback className="rounded-full bg-secondary text-3xl text-foreground">
							JD
						</AvatarFallback>
					</Avatar>
					<h2 className="mt-3 font-serif font-bold tracking-tight text-xl text-foreground">
						John Doe
					</h2>
					<p className="text-sm text-muted-foreground">
						@johndoe_creator
					</p>
				</section>

				{/* Stats Row */}
				<div className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-flat">
					<div className="grid grid-cols-3 divide-x divide-border">
						<div className="flex flex-col items-center px-2 text-center">
							<span className="text-xl font-bold text-foreground">
								137.3K
							</span>
							<span className="mt-1 text-[10px] text-muted-foreground">
								Total Reach
							</span>
						</div>
						<div className="flex flex-col items-center px-2 text-center">
							<span className="text-xl font-bold text-foreground">
								5.8%
							</span>
							<span className="mt-1 text-[10px] text-muted-foreground">
								Engagement
							</span>
						</div>
						<div className="flex flex-col items-center px-2 text-center">
							<span className="text-xl font-bold text-foreground">
								{accounts.length}
							</span>
							<span className="mt-1 text-[10px] text-muted-foreground">
								Channels
							</span>
						</div>
					</div>
				</div>

				{/* Connected Accounts */}
				<section className="mb-6">
					<div className="mb-3 flex items-center justify-between">
						<h3 className="font-serif font-bold tracking-tight text-base text-foreground">
							Connected Accounts
						</h3>
						<Dialog>
							<DialogTrigger asChild>
								<button
									type="button"
									className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
								>
									<Plus className="h-4 w-4" />
								</button>
							</DialogTrigger>
							<DialogContent className="mx-4 rounded-2xl">
								<DialogHeader>
									<DialogTitle>
										Connect TikTok Account
									</DialogTitle>
								</DialogHeader>
								<div className="flex flex-col items-center gap-4 py-6">
									<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
										<TikTokIcon className="h-8 w-8 text-primary" />
									</div>
									<p className="text-center text-sm text-muted-foreground">
										Click below to authorize LifePreneur
										Agency to access your TikTok account
										data.
									</p>
									<Button
										variant="primary"
										className="w-full gap-2 rounded-xl"
									>
										<TikTokIcon className="h-5 w-5" />
										Connect with TikTok
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					</div>

					<div className="grid grid-cols-2 gap-3">
						{accounts.slice(0, 2).map((account) => (
							<div
								key={account.id}
								className="rounded-2xl border border-border bg-card p-4 shadow-flat"
							>
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<TikTokIcon className="h-5 w-5 text-foreground" />
										<span className="text-sm font-medium text-foreground">
											TikTok
										</span>
									</div>
									<button
										type="button"
										onClick={() =>
											handleEditNickname(
												account.id,
												account.nickname,
											)
										}
										className="text-muted-foreground"
									>
										<Pencil className="h-4 w-4" />
									</button>
								</div>

								{editingId === account.id ? (
									<div className="mt-3 flex gap-2">
										<Input
											value={editNickname}
											onChange={(e) =>
												setEditNickname(e.target.value)
											}
											className="h-8 text-xs"
											autoFocus
										/>
										<Button
											size="sm"
											variant="primary"
											onClick={() =>
												handleSaveNickname(account.id)
											}
											className="h-8 px-3 text-xs"
										>
											Save
										</Button>
									</div>
								) : (
									<span
										className={`${account.nicknameColor} mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white`}
									>
										{account.nickname}
									</span>
								)}

								<p className="mt-2 truncate text-xs text-muted-foreground">
									{account.username}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									<span className="font-medium text-foreground">
										{account.followers}
									</span>{" "}
									followers
								</p>
							</div>
						))}
					</div>

					{accounts.length > 2 && (
						<button
							type="button"
							className="mt-3 w-full text-center text-sm text-primary"
						>
							View all {accounts.length} accounts
						</button>
					)}
				</section>

				{/* Upgrade Banner */}
				<div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary to-primary/85 p-4 shadow-brand-glow md:shadow-brand-glow-desktop">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-foreground/20">
							<span className="text-xl">&#x1F451;</span>
						</div>
						<div>
							<p className="font-semibold text-primary-foreground">
								Upgrade plan
							</p>
							<p className="text-xs text-primary-foreground/80">
								Go Pro for advanced tracking
							</p>
						</div>
					</div>
					<Button
						asChild
						className="rounded-xl border-0 bg-primary-foreground px-4 font-medium text-primary hover:bg-primary-foreground/90"
					>
						<Link href="/app/settings/billing">Upgrade</Link>
					</Button>
				</div>

				{/* Menu Items */}
				<div className="space-y-2">
					{menuItems.map((item) => {
						const Icon = item.icon;
						return (
							<Link
								key={item.label}
								href={item.href}
								className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-flat transition-colors active:bg-secondary"
							>
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
										<Icon className="h-5 w-5 text-muted-foreground" />
									</div>
									<span className="text-sm font-medium text-foreground">
										{item.label}
									</span>
								</div>
								<div className="flex items-center gap-2">
									{item.badge && (
										<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
											{item.badge}
										</span>
									)}
									<ChevronRight className="h-5 w-5 text-muted-foreground" />
								</div>
							</Link>
						);
					})}

					{/* Back to App */}
					<Link
						href="/app/community"
						className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-flat transition-colors active:bg-secondary"
					>
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
								<LogOut className="h-5 w-5 text-destructive" />
							</div>
							<span className="text-sm font-medium text-destructive">
								Back to App
							</span>
						</div>
						<ChevronRight className="h-5 w-5 text-muted-foreground" />
					</Link>
				</div>
			</div>
		</>
	);
}
