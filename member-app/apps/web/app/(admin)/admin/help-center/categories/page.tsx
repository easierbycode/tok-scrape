"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { Switch } from "@ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@ui/components/table";
import { Textarea } from "@ui/components/textarea";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Edit, Plus, Trash2 } from "@/modules/ui/icons";

// Common Lucide icons for selection
const LUCIDE_ICONS = [
	"Rocket",
	"CreditCard",
	"Shield",
	"Users",
	"GraduationCap",
	"HandCoins",
	"HelpCircle",
	"BookOpen",
	"Folder",
	"Settings",
	"Lock",
	"Mail",
	"MessageSquare",
	"Video",
	"FileText",
] as const;

export default function CategoriesPage() {
	const queryClient = useQueryClient();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingCategory, setEditingCategory] = useState<any>(null);
	const [formData, setFormData] = useState({
		slug: "",
		title: "",
		description: "",
		icon: "HelpCircle",
		order: 0,
		published: true,
	});

	const { data, isLoading } = useQuery(
		orpc.admin.helpCenter.categories.list.queryOptions({
			input: undefined,
		}),
	);
	const categories = data?.categories || [];

	const createMutation = useMutation({
		...orpc.admin.helpCenter.categories.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.categories.list",
			});
			toast.success("Category created successfully");
			setIsDialogOpen(false);
			resetForm();
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to create category");
		},
	});

	const updateMutation = useMutation({
		...orpc.admin.helpCenter.categories.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.categories.list",
			});
			toast.success("Category updated successfully");
			setIsDialogOpen(false);
			setEditingCategory(null);
			resetForm();
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to update category");
		},
	});

	const deleteMutation = useMutation({
		...orpc.admin.helpCenter.categories.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.categories.list",
			});
			toast.success("Category deleted successfully");
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to delete category");
		},
	});

	const moveUpMutation = useMutation({
		mutationFn: async (category: any) => {
			const currentIndex = categories.findIndex(
				(c: any) => c.id === category.id,
			);
			if (currentIndex <= 0) {
				return;
			}

			const categoryAbove = categories[currentIndex - 1];

			await orpcClient.admin.helpCenter.categories.update({
				id: category.id,
				order: categoryAbove.order,
			});
			await orpcClient.admin.helpCenter.categories.update({
				id: categoryAbove.id,
				order: category.order,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.categories.list",
			});
			toast.success("Category moved up");
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to move category");
		},
	});

	const moveDownMutation = useMutation({
		mutationFn: async (category: any) => {
			const currentIndex = categories.findIndex(
				(c: any) => c.id === category.id,
			);
			if (currentIndex >= categories.length - 1) {
				return;
			}

			const categoryBelow = categories[currentIndex + 1];

			await orpcClient.admin.helpCenter.categories.update({
				id: category.id,
				order: categoryBelow.order,
			});
			await orpcClient.admin.helpCenter.categories.update({
				id: categoryBelow.id,
				order: category.order,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.categories.list",
			});
			toast.success("Category moved down");
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to move category");
		},
	});

	const resetForm = () => {
		setFormData({
			slug: "",
			title: "",
			description: "",
			icon: "HelpCircle",
			order: 0,
			published: true,
		});
	};

	const handleEdit = (category: any) => {
		setEditingCategory(category);
		setFormData({
			slug: category.slug,
			title: category.title,
			description: category.description,
			icon: category.icon,
			order: category.order,
			published: category.published,
		});
		setIsDialogOpen(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (editingCategory) {
			updateMutation.mutate({ id: editingCategory.id, ...formData });
		} else {
			createMutation.mutate(formData);
		}
	};

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this category?")) {
			deleteMutation.mutate({ id });
		}
	};

	const generateSlug = (title: string) => {
		return title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "");
	};

	if (isLoading) {
		return <div>Loading...</div>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">
						Help Center Categories
					</h1>
					<p className="text-muted-foreground mt-2">
						Manage categories for your help center
					</p>
				</div>
				<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
					<DialogTrigger asChild>
						<Button
							onClick={() => {
								setEditingCategory(null);
								resetForm();
							}}
						>
							<Plus className="mr-2 h-4 w-4" />
							Create Category
						</Button>
					</DialogTrigger>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>
								{editingCategory
									? "Edit Category"
									: "Create Category"}
							</DialogTitle>
							<DialogDescription>
								{editingCategory
									? "Update category details"
									: "Create a new help center category"}
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit}>
							<div className="space-y-4 py-4">
								<div className="space-y-2">
									<Label htmlFor="title">Title</Label>
									<Input
										id="title"
										value={formData.title}
										onChange={(e) => {
											const title = e.target.value;
											setFormData({
												...formData,
												title,
												slug: editingCategory
													? formData.slug
													: generateSlug(title),
											});
										}}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="slug">Slug</Label>
									<Input
										id="slug"
										value={formData.slug}
										onChange={(e) =>
											setFormData({
												...formData,
												slug: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="description">
										Description
									</Label>
									<Textarea
										id="description"
										value={formData.description}
										onChange={(e) =>
											setFormData({
												...formData,
												description: e.target.value,
											})
										}
										required
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="icon">
										Icon (Lucide icon name)
									</Label>
									<Input
										id="icon"
										value={formData.icon}
										onChange={(e) =>
											setFormData({
												...formData,
												icon: e.target.value,
											})
										}
										placeholder="e.g., Rocket, Shield, Users"
										required
									/>
									<p className="text-xs text-muted-foreground">
										Common icons: {LUCIDE_ICONS.join(", ")}
									</p>
								</div>
								<div className="space-y-2">
									<Label htmlFor="order">Order</Label>
									<Input
										id="order"
										type="number"
										value={formData.order}
										onChange={(e) =>
											setFormData({
												...formData,
												order:
													Number.parseInt(
														e.target.value,
														10,
													) || 0,
											})
										}
									/>
								</div>
								<div className="flex items-center space-x-2">
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
									<Label htmlFor="published">Published</Label>
								</div>
							</div>
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => {
										setIsDialogOpen(false);
										setEditingCategory(null);
										resetForm();
									}}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={
										createMutation.isPending ||
										updateMutation.isPending
									}
								>
									{editingCategory ? "Update" : "Create"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>
			</div>

			<Card>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[120px]">Order</TableHead>
							<TableHead>Title</TableHead>
							<TableHead>Slug</TableHead>
							<TableHead>Icon</TableHead>
							<TableHead>Articles</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{categories.map((category: any, index: number) => (
							<TableRow key={category.id}>
								<TableCell>
									<div className="flex items-center gap-2">
										<span className="font-medium w-6">
											{category.order}
										</span>
										<div className="flex flex-col gap-0.5">
											<Button
												variant="ghost"
												size="sm"
												className="h-5 w-5 p-0"
												onClick={() =>
													moveUpMutation.mutate(
														category,
													)
												}
												disabled={
													index === 0 ||
													moveUpMutation.isPending ||
													moveDownMutation.isPending
												}
											>
												<ChevronUp className="h-3 w-3" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-5 w-5 p-0"
												onClick={() =>
													moveDownMutation.mutate(
														category,
													)
												}
												disabled={
													index ===
														categories.length - 1 ||
													moveUpMutation.isPending ||
													moveDownMutation.isPending
												}
											>
												<ChevronDown className="h-3 w-3" />
											</Button>
										</div>
									</div>
								</TableCell>
								<TableCell className="font-medium">
									{category.title}
								</TableCell>
								<TableCell>
									<code className="text-xs">
										{category.slug}
									</code>
								</TableCell>
								<TableCell>
									<code className="text-xs">
										{category.icon}
									</code>
								</TableCell>
								<TableCell>
									{category.articleCount || 0}
								</TableCell>
								<TableCell>
									{category.published ? (
										<span className="text-green-600">
											Published
										</span>
									) : (
										<span className="text-muted-foreground">
											Draft
										</span>
									)}
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleEdit(category)}
									>
										<Edit className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											handleDelete(category.id)
										}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Card>

			<div className="flex justify-end">
				<Button asChild variant="outline">
					<Link href="/admin/help-center/articles">
						Manage Articles →
					</Link>
				</Button>
			</div>
		</div>
	);
}
