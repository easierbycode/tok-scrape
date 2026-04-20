"use client";

import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@ui/components/dropdown-menu";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { useEffect, useState } from "react";
import {
	Copy,
	Download,
	Facebook,
	Linkedin,
	Mail,
	Plus,
	Share2,
	Trash2,
	Twitter,
} from "@/modules/ui/icons";
import { exportToCSV, shareToSocial } from "../lib/utils";

interface TrackingLink {
	id: string;
	name: string;
	token: string;
	url: string;
	clicks: number;
	leads: number;
	conversions: number;
	isPrimary: boolean;
}

export function LinksTab() {
	const [links, setLinks] = useState<TrackingLink[]>([]);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [linkName, setLinkName] = useState("");
	const [copied, setCopied] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// Fetch links on mount
	useEffect(() => {
		// TODO: Fetch from Rewardful API when integrated
		// For now, show empty state
		setLinks([]);
		setIsLoading(false);
	}, []);

	// Primary link (first link or find isPrimary)
	const primaryLink = links.find((l) => l.isPrimary) || links[0];

	// Handle copy
	const handleCopy = async (text: string, id: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(id);
			setTimeout(() => setCopied(null), 2000);
		} catch (error) {
			logger.error("Failed to copy", { error });
		}
	};

	// Handle create link
	const handleCreateLink = async () => {
		if (!linkName.trim()) {
			return;
		}

		// TODO: Implement via Rewardful API when integrated
		alert(
			"Custom link creation will be available after Rewardful integration.",
		);
		setLinkName("");
		setIsDialogOpen(false);
	};

	// Handle delete link
	const handleDeleteLink = async (_id: string) => {
		// TODO: Implement via Rewardful API when integrated
		alert("Link deletion will be available after Rewardful integration.");
	};

	// Handle export
	const handleExport = () => {
		exportToCSV(
			links.map((link) => ({
				Name: link.name,
				Token: link.token,
				URL: link.url,
				Clicks: link.clicks,
				Leads: link.leads,
				Conversions: link.conversions,
			})),
			"tracking-links",
		);
	};

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="h-8 w-48 bg-muted animate-pulse rounded" />
				<div className="h-64 bg-muted animate-pulse rounded" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with Export */}
			<div className="flex justify-between items-center">
				<h2 className="font-serif font-bold tracking-tight text-2xl">
					Tracking Links
				</h2>
				<Button variant="outline" size="sm" onClick={handleExport}>
					<Download className="w-4 h-4 mr-2" />
					Export
				</Button>
			</div>

			{/* Primary Link Card */}
			{primaryLink && (
				<Card>
					<CardHeader>
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<CardTitle>Your Referral Link</CardTitle>
								<CardDescription>
									Share this link to earn commissions
								</CardDescription>
							</div>
							{/* Social Share Dropdown */}
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										<Share2 className="w-4 h-4 mr-2" />
										Share
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-48"
								>
									<DropdownMenuItem
										onClick={() =>
											shareToSocial(
												"twitter",
												primaryLink.url,
											)
										}
									>
										<Twitter className="w-4 h-4 mr-2" />
										Share on Twitter
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											shareToSocial(
												"linkedin",
												primaryLink.url,
											)
										}
									>
										<Linkedin className="w-4 h-4 mr-2" />
										Share on LinkedIn
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											shareToSocial(
												"facebook",
												primaryLink.url,
											)
										}
									>
										<Facebook className="w-4 h-4 mr-2" />
										Share on Facebook
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={() =>
											shareToSocial(
												"email",
												primaryLink.url,
											)
										}
									>
										<Mail className="w-4 h-4 mr-2" />
										Share via Email
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* URL Input with Copy */}
						<div className="flex gap-2">
							<Input
								value={primaryLink.url}
								readOnly
								className="font-mono"
							/>
							<Button
								onClick={() =>
									handleCopy(primaryLink.url, "primary")
								}
								variant="outline"
								className="shrink-0"
							>
								{copied === "primary" ? (
									"Copied!"
								) : (
									<>
										<Copy className="w-4 h-4 mr-2" />
										Copy
									</>
								)}
							</Button>
						</div>
						{/* Stats */}
						<div className="flex items-center gap-4 text-sm text-muted-foreground">
							<span>{primaryLink.clicks} clicks</span>
							<span>•</span>
							<span>{primaryLink.leads} leads</span>
							<span>•</span>
							<span>{primaryLink.conversions} conversions</span>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Tracking Links Table */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Tracking Links</CardTitle>
							<CardDescription>
								Create custom links for different platforms
							</CardDescription>
						</div>
						<Dialog
							open={isDialogOpen}
							onOpenChange={setIsDialogOpen}
						>
							<DialogTrigger asChild>
								<Button size="sm" variant="primary">
									<Plus className="w-4 h-4 mr-2" />
									Create New Link
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>
										Create Tracking Link
									</DialogTitle>
									<DialogDescription>
										Add a custom name to track performance
										across different platforms
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4 py-4">
									<div className="space-y-2">
										<Label htmlFor="link-name">
											Link Name
										</Label>
										<Input
											id="link-name"
											placeholder="e.g., YouTube, TikTok, Instagram"
											value={linkName}
											onChange={(e) =>
												setLinkName(e.target.value)
											}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" &&
													linkName.trim()
												) {
													handleCreateLink();
												}
											}}
										/>
										{linkName && (
											<p className="text-sm text-muted-foreground">
												A new tracking link will be
												created with this name in
												Rewardful.
											</p>
										)}
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										onClick={() => setIsDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button
										onClick={handleCreateLink}
										disabled={!linkName.trim()}
										variant="primary"
									>
										Create Link
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
				</CardHeader>
				<CardContent>
					{links.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b text-sm text-muted-foreground">
										<th className="text-left py-3 px-2">
											Name / Token
										</th>
										<th className="text-right py-3 px-2">
											Clicks
										</th>
										<th className="text-right py-3 px-2">
											Leads
										</th>
										<th className="text-right py-3 px-2">
											Conversions
										</th>
										<th className="text-right py-3 px-2">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{links.map((link) => (
										<tr
											key={link.id}
											className="border-b hover:bg-muted/5 transition-colors"
										>
											<td className="py-4 px-2">
												<div className="space-y-1">
													<div className="font-medium">
														{link.name}
													</div>
													<div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
														<span>
															{link.token}
														</span>
														<button
															type="button"
															onClick={() =>
																handleCopy(
																	link.url,
																	link.token,
																)
															}
															className="hover:text-foreground transition-colors"
															aria-label={`Copy ${link.name} link`}
														>
															{copied ===
															link.token ? (
																<span className="text-green-500 text-xs">
																	Copied!
																</span>
															) : (
																<Copy className="w-3 h-3" />
															)}
														</button>
													</div>
												</div>
											</td>
											<td className="py-4 px-2 text-right font-medium">
												{link.clicks}
											</td>
											<td className="py-4 px-2 text-right font-medium">
												{link.leads}
											</td>
											<td className="py-4 px-2 text-right font-medium">
												{link.conversions}
											</td>
											<td className="py-4 px-2 text-right">
												{!link.isPrimary && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															handleDeleteLink(
																link.id,
															)
														}
														className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
														aria-label={`Delete ${link.name} link`}
													>
														<Trash2 className="w-4 h-4" />
													</Button>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="text-center py-8 text-muted-foreground">
							No additional links yet. Create one to track
							performance across platforms.
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
