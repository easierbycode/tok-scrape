"use client";

import type { Announcement } from "@repo/api/modules/admin/types";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { Switch } from "@ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Textarea } from "@ui/components/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Calendar,
	MessageSquare,
	PartyPopper,
	Star,
	Wrench,
} from "@/modules/ui/icons";

interface CreateAnnouncementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialData?: Announcement;
	onSuccess?: () => void;
}

export function CreateAnnouncementDialog({
	open,
	onOpenChange,
	initialData,
	onSuccess,
}: CreateAnnouncementDialogProps) {
	const queryClient = useQueryClient();

	const createMutation = useMutation(
		orpc.admin.announcements.create.mutationOptions(),
	);
	const updateMutation = useMutation(
		orpc.admin.announcements.update.mutationOptions(),
	);

	const [formData, setFormData] = useState({
		title: "",
		contentPreview: "",
		fullContent: "",
		type: "feature" as
			| "welcome"
			| "feature"
			| "event"
			| "maintenance"
			| "community",
		priority: "normal" as "normal" | "important" | "urgent",
		author: "Admin Team",
		published: false,
	});

	useEffect(() => {
		if (initialData) {
			setFormData({
				title: initialData.title,
				contentPreview: initialData.contentPreview,
				fullContent: initialData.fullContent,
				type: initialData.type as
					| "welcome"
					| "feature"
					| "event"
					| "maintenance"
					| "community",
				priority: initialData.priority as
					| "normal"
					| "important"
					| "urgent",
				author: initialData.author,
				published: initialData.published,
			});
		} else {
			setFormData({
				title: "",
				contentPreview: "",
				fullContent: "",
				type: "feature",
				priority: "normal",
				author: "Admin Team",
				published: false,
			});
		}
	}, [initialData, open]);

	const handleSubmit = async () => {
		if (
			!formData.title ||
			!formData.contentPreview ||
			!formData.fullContent
		) {
			return;
		}

		const toastId = toast.loading(
			initialData
				? "Updating announcement..."
				: "Creating announcement...",
		);

		try {
			if (initialData) {
				await updateMutation.mutateAsync({
					title: formData.title,
					contentPreview: formData.contentPreview,
					fullContent: formData.fullContent,
					type: formData.type as
						| "welcome"
						| "feature"
						| "event"
						| "maintenance"
						| "community",
					priority: formData.priority as
						| "normal"
						| "important"
						| "urgent",
					author: formData.author,
					published: formData.published,
					id: initialData.id,
				});
			} else {
				await createMutation.mutateAsync({
					title: formData.title,
					contentPreview: formData.contentPreview,
					fullContent: formData.fullContent,
					type: formData.type as
						| "welcome"
						| "feature"
						| "event"
						| "maintenance"
						| "community",
					priority: formData.priority as
						| "normal"
						| "important"
						| "urgent",
					author: formData.author,
					published: formData.published,
				});
			}

			queryClient.invalidateQueries({
				queryKey: orpc.admin.announcements.list.key(),
			});

			toast.success(
				initialData
					? "Announcement updated successfully"
					: "Announcement created successfully",
				{ id: toastId },
			);
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed: ${error.message}`, { id: toastId });
		}
	};

	const getTypeIcon = (type: string) => {
		const icons = {
			welcome: PartyPopper,
			feature: Star,
			event: Calendar,
			maintenance: Wrench,
			community: MessageSquare,
		};
		return icons[type as keyof typeof icons] || MessageSquare;
	};

	const getTypeColor = (type: string) => {
		const colors = {
			welcome: "bg-blue-500/10 text-blue-500 border-blue-500/20",
			feature: "bg-purple-500/10 text-purple-500 border-purple-500/20",
			event: "bg-amber-500/10 text-amber-500 border-amber-500/20",
			maintenance: "bg-red-500/10 text-red-500 border-red-500/20",
			community: "bg-green-500/10 text-green-500 border-green-500/20",
		};
		return (
			colors[type as keyof typeof colors] ||
			"bg-blue-500/10 text-blue-500 border-blue-500/20"
		);
	};

	const getPriorityIndicator = (priority: string) => {
		if (priority === "urgent") {
			return (
				<span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500" />
			);
		}
		if (priority === "important") {
			return (
				<span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-500" />
			);
		}
		return (
			<span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
		);
	};

	const TypeIcon = getTypeIcon(formData.type);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{initialData
							? "Edit Announcement"
							: "Create Announcement"}
					</DialogTitle>
					<DialogDescription>
						{initialData
							? "Update the announcement details below"
							: "Fill in the details to create a new announcement for all users"}
					</DialogDescription>
				</DialogHeader>

				<Tabs defaultValue="content" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="content">Content</TabsTrigger>
						<TabsTrigger value="preview">Preview</TabsTrigger>
					</TabsList>

					<TabsContent value="content" className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label htmlFor="title">
								Title <span className="text-red-500">*</span>
							</Label>
							<Input
								id="title"
								placeholder="Enter announcement title"
								value={formData.title}
								onChange={(e) =>
									setFormData({
										...formData,
										title: e.target.value,
									})
								}
								maxLength={100}
							/>
							<p className="text-xs text-muted-foreground">
								{formData.title.length}/100 characters
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="contentPreview">
								Content Preview{" "}
								<span className="text-red-500">*</span>
							</Label>
							<Textarea
								id="contentPreview"
								placeholder="Enter a short preview (shown in announcement cards)"
								value={formData.contentPreview}
								onChange={(e) =>
									setFormData({
										...formData,
										contentPreview: e.target.value,
									})
								}
								maxLength={300}
								rows={3}
							/>
							<p className="text-xs text-muted-foreground">
								{formData.contentPreview.length}/300 characters
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="fullContent">
								Full Content{" "}
								<span className="text-red-500">*</span>
							</Label>
							<Textarea
								id="fullContent"
								placeholder="Enter the full announcement content (Markdown supported)"
								value={formData.fullContent}
								onChange={(e) =>
									setFormData({
										...formData,
										fullContent: e.target.value,
									})
								}
								rows={8}
								className="font-mono text-sm"
							/>
							<p className="text-xs text-muted-foreground">
								Markdown formatting is supported
							</p>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="type">Type</Label>
								<Select
									value={formData.type}
									onValueChange={(value: any) =>
										setFormData({
											...formData,
											type: value,
										})
									}
								>
									<SelectTrigger id="type">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="welcome">
											🎉 Welcome
										</SelectItem>
										<SelectItem value="feature">
											⭐ Feature
										</SelectItem>
										<SelectItem value="event">
											📅 Event
										</SelectItem>
										<SelectItem value="maintenance">
											🔧 Maintenance
										</SelectItem>
										<SelectItem value="community">
											💬 Community
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="priority">Priority</Label>
								<Select
									value={formData.priority}
									onValueChange={(value: any) =>
										setFormData({
											...formData,
											priority: value,
										})
									}
								>
									<SelectTrigger id="priority">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="normal">
											🔵 Normal
										</SelectItem>
										<SelectItem value="important">
											🟡 Important
										</SelectItem>
										<SelectItem value="urgent">
											🔴 Urgent
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="author">Author</Label>
							<Input
								id="author"
								placeholder="Enter author name"
								value={formData.author}
								onChange={(e) =>
									setFormData({
										...formData,
										author: e.target.value,
									})
								}
							/>
						</div>

						<div className="flex items-center justify-between rounded-lg border border-border p-4">
							<div>
								<Label
									htmlFor="published"
									className="text-base"
								>
									Published
								</Label>
								<p className="text-sm text-muted-foreground">
									Make this announcement visible to all users
								</p>
							</div>
							<Switch
								id="published"
								checked={formData.published}
								onCheckedChange={(checked) =>
									setFormData({
										...formData,
										published: checked,
									})
								}
							/>
						</div>
					</TabsContent>

					<TabsContent value="preview" className="space-y-4 pt-4">
						<Card className="p-6">
							<div className="space-y-4">
								<div className="flex items-start justify-between">
									<div className="flex items-start gap-2">
										{getPriorityIndicator(
											formData.priority,
										)}
										<h3 className="text-xl font-semibold">
											{formData.title ||
												"Untitled Announcement"}
										</h3>
									</div>
									<Badge
										className={getTypeColor(formData.type)}
									>
										<TypeIcon className="mr-1 h-3 w-3" />
										{formData.type.charAt(0).toUpperCase() +
											formData.type.slice(1)}
									</Badge>
								</div>

								<p className="text-muted-foreground">
									{formData.contentPreview ||
										"No preview content..."}
								</p>

								<div className="border-t border-border pt-4">
									<h4 className="mb-2 text-sm font-semibold">
										Full Content
									</h4>
									<div className="prose prose-sm max-w-none dark:prose-invert">
										<p className="whitespace-pre-wrap">
											{formData.fullContent ||
												"No full content..."}
										</p>
									</div>
								</div>

								<div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
									<span>
										By {formData.author || "Unknown"}
									</span>
									<span>
										{formData.published
											? "Published"
											: "Draft"}
									</span>
								</div>
							</div>
						</Card>
					</TabsContent>
				</Tabs>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSubmit}
						disabled={
							!formData.title ||
							!formData.contentPreview ||
							!formData.fullContent ||
							createMutation.isPending ||
							updateMutation.isPending
						}
						className="bg-[#FF6B35] hover:bg-[#FF6B35]/90"
					>
						{createMutation.isPending || updateMutation.isPending
							? "Processing..."
							: initialData
								? "Update"
								: "Create"}{" "}
						Announcement
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
