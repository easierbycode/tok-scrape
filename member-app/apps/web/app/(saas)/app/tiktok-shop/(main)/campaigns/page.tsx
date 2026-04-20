"use client";

import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Progress } from "@ui/components/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { useState } from "react";
import { DashboardHeader } from "@/modules/saas/tiktok-dashboard/components/dashboard-header";
import {
	Clock,
	DollarSign,
	ExternalLink,
	Percent,
	Video,
} from "@/modules/ui/icons";

const availableCampaigns = [
	{
		id: "1",
		brand: "BeautyGlow",
		name: "Summer Skincare Launch",
		postsRequired: 3,
		gmvRequired: 1500,
		commission: "15%",
		deadline: "Apr 25, 2026",
		daysLeft: 15,
	},
	{
		id: "2",
		brand: "FitLife Nutrition",
		name: "Protein Shake Promo",
		postsRequired: 5,
		gmvRequired: 3000,
		commission: "12%",
		deadline: "May 1, 2026",
		daysLeft: 21,
	},
	{
		id: "3",
		brand: "TechWear",
		name: "Smart Watch Review",
		postsRequired: 2,
		gmvRequired: null,
		commission: "Flat $500",
		deadline: "Apr 20, 2026",
		daysLeft: 10,
	},
	{
		id: "4",
		brand: "HomeChef",
		name: "Kitchen Gadgets Showcase",
		postsRequired: 4,
		gmvRequired: 2000,
		commission: "18%",
		deadline: "May 15, 2026",
		daysLeft: 35,
	},
];

interface MyCampaign {
	id: string;
	brand: string;
	name: string;
	postsRequired: number;
	postsCompleted: number;
	gmvTarget: number;
	gmvCurrent: number;
	deadline: string;
	daysLeft: number;
	status: "active" | "completed";
}

const initialMyCampaigns: MyCampaign[] = [
	{
		id: "1",
		brand: "StyleCo Fashion",
		name: "Spring Collection Drop",
		postsRequired: 5,
		postsCompleted: 3,
		gmvTarget: 2500,
		gmvCurrent: 1850,
		deadline: "Apr 13, 2026",
		daysLeft: 3,
		status: "active",
	},
	{
		id: "2",
		brand: "TechGear Pro",
		name: "Wireless Earbuds Launch",
		postsRequired: 8,
		postsCompleted: 2,
		gmvTarget: 5000,
		gmvCurrent: 980,
		deadline: "Apr 22, 2026",
		daysLeft: 12,
		status: "active",
	},
	{
		id: "3",
		brand: "GlowUp Cosmetics",
		name: "Foundation Review",
		postsRequired: 3,
		postsCompleted: 3,
		gmvTarget: 1000,
		gmvCurrent: 1250,
		deadline: "Apr 5, 2026",
		daysLeft: 0,
		status: "completed",
	},
];

export default function CampaignsPage() {
	const [myCampaigns, setMyCampaigns] =
		useState<MyCampaign[]>(initialMyCampaigns);
	const [available, setAvailable] = useState(availableCampaigns);

	function handleEnroll(campaignId: string) {
		const campaign = available.find((c) => c.id === campaignId);
		if (!campaign) {
			return;
		}

		const newMyCampaign: MyCampaign = {
			id: campaignId,
			brand: campaign.brand,
			name: campaign.name,
			postsRequired: campaign.postsRequired,
			postsCompleted: 0,
			gmvTarget: campaign.gmvRequired ?? 0,
			gmvCurrent: 0,
			deadline: campaign.deadline,
			daysLeft: campaign.daysLeft,
			status: "active",
		};

		setMyCampaigns([...myCampaigns, newMyCampaign]);
		setAvailable(available.filter((c) => c.id !== campaignId));
	}

	return (
		<>
			<DashboardHeader title="Campaigns" showBack />
			<div className="p-4 md:p-6">
				<Tabs defaultValue="my-campaigns" className="w-full">
					<TabsList className="mb-4 grid w-full grid-cols-2 rounded-xl border-0 bg-card p-1 shadow-flat">
						<TabsTrigger
							value="my-campaigns"
							className="rounded-lg border-0 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						>
							My Campaigns
						</TabsTrigger>
						<TabsTrigger
							value="available"
							className="rounded-lg border-0 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
						>
							Available
						</TabsTrigger>
					</TabsList>

					<TabsContent value="my-campaigns" className="mt-0">
						<div className="space-y-3">
							{myCampaigns.map((campaign) => {
								const postProgress =
									(campaign.postsCompleted /
										campaign.postsRequired) *
									100;
								const gmvProgress =
									campaign.gmvTarget > 0
										? (campaign.gmvCurrent /
												campaign.gmvTarget) *
											100
										: 0;
								const isCompleted =
									campaign.status === "completed";

								return (
									<div
										key={campaign.id}
										className="rounded-2xl border border-border bg-card p-4 shadow-flat"
									>
										<div className="flex items-start justify-between">
											<div>
												<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
													{campaign.brand}
												</span>
												<h3 className="mt-0.5 font-semibold text-foreground">
													{campaign.name}
												</h3>
											</div>
											<Badge
												className={`rounded-full text-[10px] ${
													isCompleted
														? "bg-success/10 text-success"
														: "bg-primary/10 text-primary"
												}`}
											>
												{isCompleted
													? "Completed"
													: "Active"}
											</Badge>
										</div>

										<div className="mt-4 space-y-3">
											<div>
												<div className="mb-1.5 flex justify-between text-xs">
													<span className="text-muted-foreground">
														Posts Progress
													</span>
													<span className="text-foreground">
														{
															campaign.postsCompleted
														}{" "}
														/{" "}
														{campaign.postsRequired}
													</span>
												</div>
												<Progress
													value={postProgress}
													className="h-2 bg-border [&>div]:bg-primary"
												/>
											</div>

											{campaign.gmvTarget > 0 && (
												<div>
													<div className="mb-1.5 flex justify-between text-xs">
														<span className="text-muted-foreground">
															GMV Progress
														</span>
														<span className="text-foreground">
															$
															{campaign.gmvCurrent.toLocaleString()}{" "}
															/ $
															{campaign.gmvTarget.toLocaleString()}
														</span>
													</div>
													<Progress
														value={gmvProgress}
														className="h-2 bg-border [&>div]:bg-success"
													/>
												</div>
											)}
										</div>

										<div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
											<Clock className="h-3.5 w-3.5" />
											{isCompleted ? (
												<span className="text-success">
													Campaign completed
												</span>
											) : (
												<span>
													{campaign.daysLeft} days
													left
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</TabsContent>

					<TabsContent value="available" className="mt-0">
						<div className="space-y-3">
							{available.map((campaign) => (
								<div
									key={campaign.id}
									className="rounded-2xl border border-border bg-card p-4 shadow-flat"
								>
									<div className="flex items-start justify-between">
										<div>
											<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
												{campaign.brand}
											</span>
											<h3 className="mt-0.5 font-semibold text-foreground">
												{campaign.name}
											</h3>
										</div>
										<ExternalLink className="h-4 w-4 text-muted-foreground" />
									</div>

									<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
										<div className="flex items-center gap-1.5 text-muted-foreground">
											<Video className="h-3.5 w-3.5" />
											<span>
												{campaign.postsRequired} posts
											</span>
										</div>
										{campaign.gmvRequired && (
											<div className="flex items-center gap-1.5 text-muted-foreground">
												<DollarSign className="h-3.5 w-3.5" />
												<span>
													$
													{campaign.gmvRequired.toLocaleString()}{" "}
													GMV
												</span>
											</div>
										)}
										<div className="flex items-center gap-1.5 text-success">
											<Percent className="h-3.5 w-3.5" />
											<span>{campaign.commission}</span>
										</div>
										<div className="flex items-center gap-1.5 text-muted-foreground">
											<Clock className="h-3.5 w-3.5" />
											<span>
												{campaign.daysLeft} days
											</span>
										</div>
									</div>

									<Button
										onClick={() =>
											handleEnroll(campaign.id)
										}
										variant="primary"
										className="mt-4 w-full rounded-xl"
									>
										Enroll Now
									</Button>
								</div>
							))}
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</>
	);
}
