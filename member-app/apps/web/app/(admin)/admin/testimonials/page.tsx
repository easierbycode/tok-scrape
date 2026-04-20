"use client";

import { config } from "@repo/config";
import { logger } from "@repo/logs";
import { TestimonialAvatar } from "@shared/components/TestimonialAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import {
	Dialog,
	DialogContent,
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
import { Textarea } from "@ui/components/textarea";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
	MoveDown,
	MoveUp,
	Pencil,
	Plus,
	Trash2,
	Upload,
} from "@/modules/ui/icons";

export default function TestimonialsAdmin() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		role: "",
		avatar: "",
		rating: 5,
		content: "",
		stats: "",
		published: true,
	});

	const queryClient = useQueryClient();

	const {
		data: testimonials,
		isLoading,
		error: _error,
	} = useQuery(orpc.admin.testimonials.list.queryOptions());

	const uploadImageMutation = useMutation(
		orpc.admin.testimonials.imageUploadUrl.mutationOptions(),
	);

	const createMutation = useMutation({
		...orpc.admin.testimonials.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["testimonials-admin"] });
			queryClient.invalidateQueries({ queryKey: ["testimonials"] });
			toast.success("Testimonial created successfully");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => {
			toast.error("Failed to create testimonial");
		},
	});

	const updateMutation = useMutation({
		...orpc.admin.testimonials.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["testimonials-admin"] });
			queryClient.invalidateQueries({ queryKey: ["testimonials"] });
			toast.success("Testimonial updated successfully");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => {
			toast.error("Failed to update testimonial");
		},
	});

	const deleteMutation = useMutation({
		...orpc.admin.testimonials.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["testimonials-admin"] });
			queryClient.invalidateQueries({ queryKey: ["testimonials"] });
			toast.success("Testimonial deleted successfully");
		},
		onError: () => {
			toast.error("Failed to delete testimonial");
		},
	});

	const reorderMutation = useMutation({
		...orpc.admin.testimonials.reorder.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["testimonials-admin"] });
			queryClient.invalidateQueries({ queryKey: ["testimonials"] });
		},
	});

	const { getRootProps, getInputProps } = useDropzone({
		onDrop: async (files) => {
			if (!files[0]) {
				return;
			}

			const file = files[0];
			const MAX_SIZE = 5 * 1024 * 1024; // 5MB

			// Validate file size
			if (file.size > MAX_SIZE) {
				toast.error("Image too large", {
					description:
						"Maximum file size is 5MB. Please choose a smaller image.",
				});
				return;
			}

			// Validate file type
			const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
			if (!allowedTypes.includes(file.type)) {
				toast.error("Invalid file type", {
					description: "Please upload a PNG, JPG, or JPEG image.",
				});
				return;
			}

			setUploading(true);
			try {
				// Get file extension
				const fileExtension =
					file.name.split(".").pop()?.toLowerCase() || "jpg";
				const normalizedExtension =
					fileExtension === "jpeg" ? "jpg" : fileExtension;

				const { signedUploadUrl, path } =
					await uploadImageMutation.mutateAsync({
						contentType: file.type,
						fileExtension: `.${normalizedExtension}`,
					});

				const response = await fetch(signedUploadUrl, {
					method: "PUT",
					body: file,
					headers: { "Content-Type": file.type },
				});

				if (!response.ok) {
					throw new Error(
						`Upload failed with status ${response.status}`,
					);
				}

				setFormData((prev) => ({ ...prev, avatar: path }));
				toast.success("Image uploaded successfully");
			} catch (error) {
				logger.error("Upload error", { error });
				toast.error("Failed to upload image", {
					description:
						error instanceof Error
							? error.message
							: "Please try again or use a different image.",
				});
			} finally {
				setUploading(false);
			}
		},
		accept: { "image/*": [".png", ".jpg", ".jpeg"] },
		maxSize: 5 * 1024 * 1024, // 5MB
		multiple: false,
	});

	const avatarSrc = formData.avatar
		? `/image-proxy/${config.storage.bucketNames.testimonials}/${formData.avatar}`
		: null;

	const resetForm = () => {
		setFormData({
			name: "",
			role: "",
			avatar: "",
			rating: 5,
			content: "",
			stats: "",
			published: true,
		});
		setEditingId(null);
	};

	const handleEdit = (testimonial: any) => {
		setEditingId(testimonial.id);
		setFormData({
			name: testimonial.name,
			role: testimonial.role,
			avatar: testimonial.avatar,
			rating: testimonial.rating,
			content: testimonial.content,
			stats: testimonial.stats,
			published: testimonial.published,
		});
		setDialogOpen(true);
	};

	const handleSubmit = useCallback(() => {
		if (
			!formData.name ||
			!formData.role ||
			!formData.content ||
			!formData.stats
		) {
			toast.error("Please fill in all required fields");
			return;
		}

		if (!formData.avatar) {
			toast.error("Please upload an avatar image");
			return;
		}

		if (process.env.NODE_ENV === "development") {
			logger.debug("Submitting testimonial with avatar", {
				avatar: formData.avatar,
			});
		}

		if (editingId) {
			updateMutation.mutate({
				id: editingId,
				...formData,
			});
		} else {
			createMutation.mutate({
				...formData,
				order: testimonials?.length || 0,
			});
		}
	}, [formData, editingId, updateMutation, createMutation, testimonials]);

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this testimonial?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleMove = (id: string, direction: "up" | "down") => {
		if (!testimonials) {
			return;
		}
		const index = testimonials.findIndex((t) => t.id === id);
		if (index === -1) {
			return;
		}

		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= testimonials.length) {
			return;
		}

		const updates = testimonials.map((t, i) => ({
			id: t.id,
			order: i === index ? newIndex : i === newIndex ? index : i,
		}));

		reorderMutation.mutate({ updates });
	};

	if (isLoading) {
		return (
			<div className="container max-w-6xl py-8">
				<div className="text-center">Loading...</div>
			</div>
		);
	}

	return (
		<div className="container max-w-6xl py-8">
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-3xl font-bold">Manage Testimonials</h1>
					<p className="text-muted-foreground mt-2">
						Edit success stories shown on homepage
					</p>
				</div>
				<Button
					onClick={() => {
						resetForm();
						setDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Testimonial
				</Button>
			</div>

			<div className="grid gap-4">
				{testimonials?.map((testimonial, index) => (
					<Card key={testimonial.id} className="p-4">
						<div className="flex items-center gap-4">
							<TestimonialAvatar
								name={testimonial.name}
								avatarUrl={testimonial.avatar}
								className="h-16 w-16"
							/>
							<div className="flex-1 min-w-0">
								<div className="font-semibold">
									{testimonial.name}
								</div>
								<div className="text-sm text-muted-foreground">
									{testimonial.role} • {testimonial.stats}
								</div>
								<div className="text-sm text-muted-foreground line-clamp-1 mt-1">
									{testimonial.content}
								</div>
								<div className="flex items-center gap-2 mt-2">
									{testimonial.published ? (
										<span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
											Published
										</span>
									) : (
										<span className="text-xs bg-gray-500/20 text-gray-500 px-2 py-0.5 rounded">
											Draft
										</span>
									)}
									<span className="text-xs text-muted-foreground">
										Order: {testimonial.order}
									</span>
								</div>
							</div>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="ghost"
									onClick={() =>
										handleMove(testimonial.id, "up")
									}
									disabled={index === 0}
								>
									<MoveUp className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() =>
										handleMove(testimonial.id, "down")
									}
									disabled={
										index ===
										(testimonials?.length || 0) - 1
									}
								>
									<MoveDown className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => handleEdit(testimonial)}
								>
									<Pencil className="h-4 w-4" />
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => handleDelete(testimonial.id)}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					</Card>
				))}
				{testimonials?.length === 0 && (
					<div className="text-center py-12 text-muted-foreground">
						No testimonials yet. Click "Add Testimonial" to create
						one.
					</div>
				)}
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Testimonial" : "Add Testimonial"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label>Avatar Image</Label>
							<div
								{...getRootProps()}
								className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors mt-2"
							>
								<input {...getInputProps()} />
								{avatarSrc ? (
									<div className="flex flex-col items-center gap-2">
										<TestimonialAvatar
											name={formData.name || "Preview"}
											avatarUrl={formData.avatar}
											className="h-24 w-24"
										/>
										<p className="text-sm text-muted-foreground">
											Click to change image
										</p>
									</div>
								) : (
									<div>
										<Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
										<p className="text-sm text-muted-foreground">
											Click to upload avatar
										</p>
									</div>
								)}
								{uploading && (
									<p className="text-sm text-muted-foreground mt-2">
										Uploading...
									</p>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-2">
								Requirements: PNG, JPG, or JPEG • Max 5MB •
								Square images recommended
							</p>
						</div>

						<div>
							<Label htmlFor="name">Name *</Label>
							<Input
								id="name"
								placeholder="John Doe"
								value={formData.name}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										name: e.target.value,
									}))
								}
							/>
						</div>

						<div>
							<Label htmlFor="role">Role *</Label>
							<Input
								id="role"
								placeholder="TikTok Shop Seller"
								value={formData.role}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										role: e.target.value,
									}))
								}
							/>
						</div>

						<div>
							<Label htmlFor="stats">Stats *</Label>
							<Input
								id="stats"
								placeholder="$15K/mo"
								value={formData.stats}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										stats: e.target.value,
									}))
								}
							/>
						</div>

						<div>
							<Label htmlFor="rating">Rating</Label>
							<Select
								value={formData.rating.toString()}
								onValueChange={(value) =>
									setFormData((p) => ({
										...p,
										rating: Number.parseInt(value, 10),
									}))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{[1, 2, 3, 4, 5].map((rating) => (
										<SelectItem
											key={rating}
											value={rating.toString()}
										>
											{rating} Star
											{rating !== 1 ? "s" : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="content">Content *</Label>
							<Textarea
								id="content"
								placeholder="Testimonial content..."
								value={formData.content}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										content: e.target.value,
									}))
								}
								rows={4}
							/>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								id="published"
								checked={formData.published}
								onCheckedChange={(checked) =>
									setFormData((p) => ({
										...p,
										published: checked,
									}))
								}
							/>
							<Label htmlFor="published">Published</Label>
						</div>

						<div className="flex gap-2 justify-end">
							<Button
								variant="outline"
								onClick={() => {
									setDialogOpen(false);
									resetForm();
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSubmit}
								disabled={
									uploading ||
									createMutation.isPending ||
									updateMutation.isPending ||
									!formData.avatar
								}
							>
								{editingId ? "Update" : "Create"} Testimonial
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
