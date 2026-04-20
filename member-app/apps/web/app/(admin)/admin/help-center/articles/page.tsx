"use client";

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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
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
import { Edit, Plus, Trash2 } from "@/modules/ui/icons";

export default function ArticlesPage() {
	const queryClient = useQueryClient();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [editingArticle, setEditingArticle] = useState<any>(null);
	const [selectedCategoryFilter, setSelectedCategoryFilter] =
		useState<string>("all");
	const [formData, setFormData] = useState({
		slug: "",
		title: "",
		content: "",
		excerpt: "",
		categoryId: "",
		audience: "both",
		subsection: "",
		featured: false,
		order: 0,
		published: true,
	});

	const { data: categoriesData } = useQuery(
		orpc.admin.helpCenter.categories.list.queryOptions({
			input: undefined,
		}),
	);
	const categories = categoriesData?.categories || [];

	const { data: articlesData, isLoading } = useQuery(
		orpc.admin.helpCenter.articles.list.queryOptions({ input: undefined }),
	);
	const articles = articlesData?.articles || [];

	const createMutation = useMutation({
		...orpc.admin.helpCenter.articles.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.articles.list",
			});
			toast.success("Article created successfully");
			setIsDialogOpen(false);
			resetForm();
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to create article");
		},
	});

	const updateMutation = useMutation({
		...orpc.admin.helpCenter.articles.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.articles.list",
			});
			toast.success("Article updated successfully");
			setIsDialogOpen(false);
			setEditingArticle(null);
			resetForm();
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to update article");
		},
	});

	const deleteMutation = useMutation({
		...orpc.admin.helpCenter.articles.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) =>
					query.queryKey[0] === "admin.helpCenter.articles.list",
			});
			toast.success("Article deleted successfully");
		},
		onError: (error: any) => {
			toast.error(error?.message || "Failed to delete article");
		},
	});

	const resetForm = () => {
		setFormData({
			slug: "",
			title: "",
			content: "",
			excerpt: "",
			categoryId: "",
			audience: "both",
			subsection: "",
			featured: false,
			order: 0,
			published: true,
		});
	};

	const handleEdit = (article: any) => {
		setEditingArticle(article);
		setFormData({
			slug: article.slug,
			title: article.title,
			content: article.content,
			excerpt: article.excerpt || "",
			categoryId: article.categoryId,
			audience: article.audience || "both",
			subsection: article.subsection || "",
			featured: article.featured,
			order: article.order,
			published: article.published,
		});
		setIsDialogOpen(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const payload = {
			...formData,
			subsection: formData.subsection.trim() || undefined,
		};
		if (editingArticle) {
			updateMutation.mutate({ id: editingArticle.id, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	};

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this article?")) {
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

	const categoryMap = new Map(categories.map((cat: any) => [cat.id, cat]));

	// Filter articles by selected category
	const filteredArticles =
		selectedCategoryFilter === "all"
			? articles
			: articles.filter(
					(article: any) =>
						article.categoryId === selectedCategoryFilter,
				);

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Help Center Articles</h1>
					<p className="text-muted-foreground mt-2">
						Create and manage help center articles
					</p>
				</div>
				<div className="flex items-center gap-4">
					<Select
						value={selectedCategoryFilter}
						onValueChange={setSelectedCategoryFilter}
					>
						<SelectTrigger className="w-[200px]">
							<SelectValue placeholder="Filter by category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{categories.map((category: any) => (
								<SelectItem
									key={category.id}
									value={category.id}
								>
									{category.title}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogTrigger asChild>
					<Button
						onClick={() => {
							setEditingArticle(null);
							resetForm();
						}}
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Article
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingArticle ? "Edit Article" : "Create Article"}
						</DialogTitle>
						<DialogDescription>
							{editingArticle
								? "Update article details"
								: "Create a new help center article"}
						</DialogDescription>
					</DialogHeader>
					<form onSubmit={handleSubmit}>
						<div className="space-y-4 py-4">
							<div className="grid grid-cols-2 gap-4">
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
												slug: editingArticle
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
							</div>
							<div className="space-y-2">
								<Label htmlFor="categoryId">Category</Label>
								<Select
									value={formData.categoryId}
									onValueChange={(value) =>
										setFormData({
											...formData,
											categoryId: value,
										})
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select a category" />
									</SelectTrigger>
									<SelectContent>
										{categories.map((category: any) => (
											<SelectItem
												key={category.id}
												value={category.id}
											>
												{category.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-2">
									<Label htmlFor="audience">Audience</Label>
									<Select
										value={formData.audience}
										onValueChange={(value) =>
											setFormData({
												...formData,
												audience: value,
											})
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select audience" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="both">
												Both (buyer + member)
											</SelectItem>
											<SelectItem value="buyer">
												Buyer only
											</SelectItem>
											<SelectItem value="member">
												Member only
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="subsection">
										Subsection (optional)
									</Label>
									<Input
										id="subsection"
										value={formData.subsection}
										onChange={(e) =>
											setFormData({
												...formData,
												subsection: e.target.value,
											})
										}
										placeholder="e.g. discord, norms"
									/>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="excerpt">Excerpt</Label>
								<Textarea
									id="excerpt"
									value={formData.excerpt}
									onChange={(e) =>
										setFormData({
											...formData,
											excerpt: e.target.value,
										})
									}
									rows={2}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="content">
									Content (Markdown)
								</Label>
								<details className="group">
									<summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
										Markdown cheat sheet
									</summary>
									<div className="mt-1.5 rounded-md border bg-muted/50 p-3 text-xs font-mono space-y-1.5">
										<p>
											<strong># Heading 1</strong> &nbsp;{" "}
											<strong>## Heading 2</strong> &nbsp;{" "}
											<strong>### Heading 3</strong>
										</p>
										<p>
											**bold text** &nbsp; *italic text*
										</p>
										<p>
											- bullet item &nbsp; 1. numbered
											item
										</p>
										<p>[link text](https://example.com)</p>
										<p>--- (horizontal rule)</p>
										<p>&gt; blockquote</p>
									</div>
								</details>
								<Textarea
									id="content"
									value={formData.content}
									onChange={(e) =>
										setFormData({
											...formData,
											content: e.target.value,
										})
									}
									rows={15}
									className="font-mono text-sm"
									required
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
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
								<div className="flex items-center space-x-4 pt-8">
									<div className="flex items-center space-x-2">
										<Switch
											id="featured"
											checked={formData.featured}
											onCheckedChange={(checked) =>
												setFormData({
													...formData,
													featured: checked,
												})
											}
										/>
										<Label htmlFor="featured">
											Featured
										</Label>
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
										<Label htmlFor="published">
											Published
										</Label>
									</div>
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => {
									setIsDialogOpen(false);
									setEditingArticle(null);
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
								{editingArticle ? "Update" : "Create"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Card>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Title</TableHead>
							<TableHead>Category</TableHead>
							<TableHead>Audience</TableHead>
							<TableHead>Slug</TableHead>
							<TableHead>Views</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{filteredArticles.map((article: any) => (
							<TableRow key={article.id}>
								<TableCell className="font-medium">
									{article.featured && "⭐ "}
									{article.title}
								</TableCell>
								<TableCell>
									{categoryMap.get(article.categoryId)
										?.title || "Unknown"}
								</TableCell>
								<TableCell>
									<span className="text-xs capitalize">
										{article.audience || "both"}
									</span>
								</TableCell>
								<TableCell>
									<code className="text-xs">
										{article.slug}
									</code>
								</TableCell>
								<TableCell>{article.views || 0}</TableCell>
								<TableCell>
									{article.published ? (
										<span className="text-green-600">
											Published
										</span>
									) : (
										<span className="text-gray-500">
											Draft
										</span>
									)}
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleEdit(article)}
										>
											<Edit className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												handleDelete(article.id)
											}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Card>

			<div className="flex justify-end">
				<Button asChild variant="outline">
					<Link href="/admin/help-center/categories">
						Manage Categories →
					</Link>
				</Button>
			</div>
		</div>
	);
}
