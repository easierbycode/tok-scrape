"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	PricingCardPreview,
	type PricingPlan,
} from "@marketing/home/components/v0/pricing-cards";
import { config } from "@repo/config";
import { logger } from "@repo/logs";
import { TestimonialAvatar } from "@shared/components/TestimonialAvatar";
import { clearMarketingCache } from "@shared/lib/cache";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
	AlertTriangle,
	ArrowRight,
	CreditCard,
	Crown,
	DollarSign,
	DotsThreeVerticalIcon,
	Flame,
	Gift,
	Globe,
	GraduationCap,
	Headphones,
	Heart,
	HelpCircle,
	Lightbulb,
	LightningIcon,
	Link2,
	MedalIcon,
	Megaphone,
	MessageSquareQuote,
	MoveDown,
	MoveUp,
	Pencil,
	Play,
	PlayCircle,
	Plus,
	Rocket,
	Save,
	Shield,
	ShieldCheck,
	Sparkles,
	Star,
	Target,
	Trash2,
	TrendingUp,
	Trophy,
	Upload,
	Users,
	Video,
	Wand,
	Zap,
} from "@/modules/ui/icons";

// ─── Shared hook for marketing content ───

function useMarketingContent() {
	const queryClient = useQueryClient();

	const { data: content, isLoading } = useQuery(
		orpc.admin.marketing.content.queryOptions(),
	);

	const upsertMutation = useMutation({
		...orpc.admin.marketing.upsertContent.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Changes saved");
		},
		onError: () => {
			toast.error("Failed to save changes");
		},
	});

	return { content, isLoading, upsertMutation };
}

// ─── Hero Tab ───

function HeroTab() {
	const { content, isLoading, upsertMutation } = useMarketingContent();

	const [form, setForm] = useState({
		heroHeadline: "",
		heroHeadlineAccent: "",
		heroSubheadline: "",
		heroCtaText: "",
		heroBadgeText: "",
		heroVideoUrl: "",
		heroThumbnailUrl: "",
	});
	const [thumbnailUploading, setThumbnailUploading] = useState(false);

	const thumbnailUploadMutation = useMutation(
		orpc.admin.marketing.heroThumbnailUploadUrl.mutationOptions(),
	);

	useEffect(() => {
		if (content) {
			setForm({
				heroHeadline: content.heroHeadline || "",
				heroHeadlineAccent: content.heroHeadlineAccent || "",
				heroSubheadline: content.heroSubheadline || "",
				heroCtaText: content.heroCtaText || "",
				heroBadgeText: content.heroBadgeText || "",
				heroVideoUrl: content.heroVideoUrl || "",
				heroThumbnailUrl: content.heroThumbnailUrl || "",
			});
		}
	}, [content]);

	const {
		getRootProps: getThumbnailRootProps,
		getInputProps: getThumbnailInputProps,
	} = useDropzone({
		onDrop: async (files) => {
			if (!files[0]) {
				return;
			}
			const file = files[0];
			if (file.size > 5 * 1024 * 1024) {
				toast.error("Image too large", {
					description: "Maximum file size is 5MB.",
				});
				return;
			}
			const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
			if (!allowedTypes.includes(file.type)) {
				toast.error("Invalid file type", {
					description: "Please upload a PNG or JPG image.",
				});
				return;
			}
			setThumbnailUploading(true);
			try {
				const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
				const normalizedExt = ext === "jpeg" ? "jpg" : ext;
				const { signedUploadUrl, path } =
					await thumbnailUploadMutation.mutateAsync({
						contentType: file.type,
						fileExtension: `.${normalizedExt}`,
					});
				const res = await fetch(signedUploadUrl, {
					method: "PUT",
					body: file,
					headers: { "Content-Type": file.type },
				});
				if (!res.ok) {
					throw new Error(`Upload failed with status ${res.status}`);
				}
				setForm((p) => ({ ...p, heroThumbnailUrl: path }));
				toast.success("Thumbnail uploaded");
			} catch (error) {
				logger.error("Thumbnail upload error", { error });
				toast.error("Failed to upload thumbnail", {
					description:
						error instanceof Error
							? error.message
							: "Please try again.",
				});
			} finally {
				setThumbnailUploading(false);
			}
		},
		accept: { "image/*": [".png", ".jpg", ".jpeg"] },
		maxSize: 5 * 1024 * 1024,
		multiple: false,
	});

	const handleSave = useCallback(() => {
		upsertMutation.mutate(form);
	}, [form, upsertMutation]);

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Play className="h-5 w-5 text-primary" />
						<CardTitle>Hero Section</CardTitle>
					</div>
					<CardDescription>
						Manage the headline, video, and call-to-action on the
						homepage hero
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor="heroBadgeText">Badge Text</Label>
						<Input
							id="heroBadgeText"
							placeholder="Join Our Growing Community"
							value={form.heroBadgeText}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroBadgeText: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							The small pill/badge above the headline
						</p>
					</div>

					<div>
						<Label htmlFor="heroHeadline">Headline</Label>
						<Input
							id="heroHeadline"
							placeholder="The Simplest Way to Start Winning on TikTok Shop"
							value={form.heroHeadline}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroHeadline: e.target.value,
								}))
							}
						/>
					</div>

					<div>
						<Label htmlFor="heroHeadlineAccent">
							Headline Accent (Orange Text)
						</Label>
						<Input
							id="heroHeadlineAccent"
							placeholder="TikTok Shop"
							value={form.heroHeadlineAccent}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroHeadlineAccent: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							The exact phrase from your headline to display in
							orange. Leave blank to auto-highlight the last word.
						</p>
					</div>

					<div>
						<Label htmlFor="heroSubheadline">Subheadline</Label>
						<Textarea
							id="heroSubheadline"
							placeholder="Join a thriving community of creators..."
							value={form.heroSubheadline}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroSubheadline: e.target.value,
								}))
							}
							rows={3}
						/>
					</div>

					<div>
						<Label htmlFor="heroCtaText">CTA Button Text</Label>
						<Input
							id="heroCtaText"
							placeholder="Join the Community"
							value={form.heroCtaText}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroCtaText: e.target.value,
								}))
							}
						/>
					</div>

					<div>
						<Label htmlFor="heroVideoUrl">Video URL</Label>
						<Input
							id="heroVideoUrl"
							placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
							value={form.heroVideoUrl}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									heroVideoUrl: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							YouTube, Vimeo embed URL, or direct .mp4/.webm file
							URL. Leave blank to hide the play button.
						</p>
					</div>

					<div className="flex flex-col gap-2">
						<Label>Video Thumbnail</Label>
						{form.heroThumbnailUrl ? (
							<div className="flex items-center gap-3">
								{/* biome-ignore lint/performance/noImgElement: admin preview — arbitrary proxy URL, next/image not suitable */}
								<img
									src={
										form.heroThumbnailUrl.startsWith(
											"http",
										) ||
										form.heroThumbnailUrl.startsWith("/")
											? form.heroThumbnailUrl
											: `/image-proxy/${config.storage.bucketNames.marketing}/${form.heroThumbnailUrl}`
									}
									alt="Hero thumbnail preview"
									className="h-20 w-12 rounded-lg object-cover border border-border"
								/>
								<div className="flex flex-col gap-1">
									<p className="text-xs text-muted-foreground">
										Thumbnail uploaded
									</p>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setForm((p) => ({
												...p,
												heroThumbnailUrl: "",
											}))
										}
									>
										Remove
									</Button>
								</div>
							</div>
						) : (
							<div
								{...getThumbnailRootProps()}
								className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
							>
								<input {...getThumbnailInputProps()} />
								{thumbnailUploading ? (
									<p className="text-sm text-muted-foreground">
										Uploading...
									</p>
								) : (
									<>
										<Upload className="h-6 w-6 text-muted-foreground" />
										<p className="text-sm text-muted-foreground">
											Drop an image here or{" "}
											<span className="text-primary font-medium">
												click to browse
											</span>
										</p>
										<p className="text-xs text-muted-foreground">
											PNG or JPG, max 5MB. Shown inside
											the phone mockup before the video
											plays.
										</p>
									</>
								)}
							</div>
						)}
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={handleSave}
					disabled={upsertMutation.isPending}
					size="lg"
				>
					<Save className="mr-2 h-4 w-4" />
					{upsertMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}

// ─── CTAs Tab (Final CTA + Sticky CTA) ───

function CtasTab() {
	const { content, isLoading, upsertMutation } = useMarketingContent();

	const [form, setForm] = useState({
		ctaBadgeText: "",
		ctaHeadline: "",
		ctaDescription: "",
		ctaButtonText: "",
		stickyCtaTitle: "",
		stickyCtaSubtitle: "",
		stickyCtaButtonText: "",
		stickyCtaMobileText: "",
		stickyCtaLink: "",
	});

	useEffect(() => {
		if (content) {
			setForm({
				ctaBadgeText: content.ctaBadgeText || "",
				ctaHeadline: content.ctaHeadline || "",
				ctaDescription: content.ctaDescription || "",
				ctaButtonText: content.ctaButtonText || "",
				stickyCtaTitle: content.stickyCtaTitle || "",
				stickyCtaSubtitle: content.stickyCtaSubtitle || "",
				stickyCtaButtonText: content.stickyCtaButtonText || "",
				stickyCtaMobileText: content.stickyCtaMobileText || "",
				stickyCtaLink: content.stickyCtaLink || "",
			});
		}
	}, [content]);

	const handleSave = useCallback(() => {
		upsertMutation.mutate(form);
	}, [form, upsertMutation]);

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Final CTA Section */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						<CardTitle>Final CTA Section</CardTitle>
					</div>
					<CardDescription>
						The closing call-to-action block at the bottom of the
						homepage
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor="ctaBadgeText">Badge Text</Label>
						<Input
							id="ctaBadgeText"
							placeholder="Limited Time Offer"
							value={form.ctaBadgeText}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									ctaBadgeText: e.target.value,
								}))
							}
						/>
					</div>
					<div>
						<Label htmlFor="ctaHeadline">Headline</Label>
						<Input
							id="ctaHeadline"
							placeholder="Ready to Build Your Creator Business?"
							value={form.ctaHeadline}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									ctaHeadline: e.target.value,
								}))
							}
						/>
					</div>
					<div>
						<Label htmlFor="ctaDescription">Description</Label>
						<Textarea
							id="ctaDescription"
							placeholder="Join 300+ creators mastering TikTok Shop..."
							value={form.ctaDescription}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									ctaDescription: e.target.value,
								}))
							}
							rows={3}
						/>
					</div>
					<div>
						<Label htmlFor="ctaButtonText">Button Text</Label>
						<Input
							id="ctaButtonText"
							placeholder="Get Started Today"
							value={form.ctaButtonText}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									ctaButtonText: e.target.value,
								}))
							}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Sticky CTA Bar */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<ArrowRight className="h-5 w-5 text-primary" />
						<CardTitle>Sticky CTA Bar</CardTitle>
					</div>
					<CardDescription>
						The floating bar that appears at the bottom of the
						screen as users scroll. It hides when the pricing or
						final CTA sections are in view.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor="stickyCtaTitle">Title (Desktop)</Label>
						<Input
							id="stickyCtaTitle"
							placeholder="Join the LifePreneur Community"
							value={form.stickyCtaTitle}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									stickyCtaTitle: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Shown on desktop alongside the button
						</p>
					</div>
					<div>
						<Label htmlFor="stickyCtaSubtitle">
							Subtitle (Desktop)
						</Label>
						<Input
							id="stickyCtaSubtitle"
							placeholder="Starting at $99/mo"
							value={form.stickyCtaSubtitle}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									stickyCtaSubtitle: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Small text below the title on desktop
						</p>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<Label htmlFor="stickyCtaButtonText">
								Button Text (Desktop)
							</Label>
							<Input
								id="stickyCtaButtonText"
								placeholder="Get Started"
								value={form.stickyCtaButtonText}
								onChange={(e) =>
									setForm((p) => ({
										...p,
										stickyCtaButtonText: e.target.value,
									}))
								}
							/>
						</div>
						<div>
							<Label htmlFor="stickyCtaMobileText">
								Button Text (Mobile)
							</Label>
							<Input
								id="stickyCtaMobileText"
								placeholder="Join Now - $99/mo"
								value={form.stickyCtaMobileText}
								onChange={(e) =>
									setForm((p) => ({
										...p,
										stickyCtaMobileText: e.target.value,
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								On mobile, the button fills the full width
							</p>
						</div>
					</div>
					<div>
						<Label htmlFor="stickyCtaLink">Link URL</Label>
						<Input
							id="stickyCtaLink"
							placeholder="#pricing"
							value={form.stickyCtaLink}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									stickyCtaLink: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Use #pricing to scroll to pricing, or a full URL
							like /checkout/promo
						</p>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={handleSave}
					disabled={upsertMutation.isPending}
					size="lg"
				>
					<Save className="mr-2 h-4 w-4" />
					{upsertMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}

// ─── SEO Tab ───

function SeoTab() {
	const { content, isLoading, upsertMutation } = useMarketingContent();

	const [form, setForm] = useState({
		seoTitle: "",
		seoDescription: "",
		seoOgImage: "",
	});

	useEffect(() => {
		if (content) {
			setForm({
				seoTitle: content.seoTitle || "",
				seoDescription: content.seoDescription || "",
				seoOgImage: content.seoOgImage || "",
			});
		}
	}, [content]);

	const handleSave = useCallback(() => {
		upsertMutation.mutate(form);
	}, [form, upsertMutation]);

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Globe className="h-5 w-5 text-primary" />
						<CardTitle>SEO Settings</CardTitle>
					</div>
					<CardDescription>
						Control how the homepage appears in search results and
						social shares. These settings update the page title,
						meta description, and Open Graph image.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor="seoTitle">Page Title</Label>
						<Input
							id="seoTitle"
							placeholder="Join LifePreneur - TikTok Shop Creator Community"
							value={form.seoTitle}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									seoTitle: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{form.seoTitle.length}/60 characters (recommended)
						</p>
					</div>

					<div>
						<Label htmlFor="seoDescription">Meta Description</Label>
						<Textarea
							id="seoDescription"
							placeholder="Daily live training, private Discord community..."
							value={form.seoDescription}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									seoDescription: e.target.value,
								}))
							}
							rows={3}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							{form.seoDescription.length}/160 characters
							(recommended)
						</p>
					</div>

					<div>
						<Label htmlFor="seoOgImage">Open Graph Image URL</Label>
						<Input
							id="seoOgImage"
							placeholder="https://lifepreneur.io/og-image.jpg"
							value={form.seoOgImage}
							onChange={(e) =>
								setForm((p) => ({
									...p,
									seoOgImage: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Image shown when shared on social media (1200x630px
							recommended)
						</p>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={handleSave}
					disabled={upsertMutation.isPending}
					size="lg"
				>
					<Save className="mr-2 h-4 w-4" />
					{upsertMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}

// ─── Affiliate link (/r) Tab ───

function AffiliateTab() {
	const { content, isLoading, upsertMutation } = useMarketingContent();
	const [affiliateLinkComingSoon, setAffiliateLinkComingSoon] =
		useState(false);

	useEffect(() => {
		if (content) {
			setAffiliateLinkComingSoon(
				content.affiliateLinkComingSoon ?? false,
			);
		}
	}, [content]);

	const handleSave = useCallback(() => {
		upsertMutation.mutate({ affiliateLinkComingSoon });
	}, [affiliateLinkComingSoon, upsertMutation]);

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Link2 className="h-5 w-5 text-primary" />
						<CardTitle>Affiliate link (/r)</CardTitle>
					</div>
					<CardDescription>
						Controls the public URL{" "}
						<code className="text-xs">/r</code> used for affiliate
						tracking. When coming soon mode is off, visitors are
						redirected to the homepage pricing section. When on,
						they see a standalone message with no link to the
						homepage.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<Label htmlFor="affiliate-coming-soon">
								Coming soon mode
							</Label>
							<p className="text-sm text-muted-foreground">
								When enabled,{" "}
								<code className="text-xs">/r</code> shows an
								updating-plans message instead of sending
								visitors to pricing.
							</p>
						</div>
						<Switch
							id="affiliate-coming-soon"
							checked={affiliateLinkComingSoon}
							onCheckedChange={setAffiliateLinkComingSoon}
							className="shrink-0"
						/>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={handleSave}
					disabled={upsertMutation.isPending}
					size="lg"
				>
					<Save className="mr-2 h-4 w-4" />
					{upsertMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}

// ─── FAQs Tab ───

function FaqsTab() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		question: "",
		answer: "",
		published: true,
		flagged: false,
	});

	const { data: faqs, isLoading } = useQuery(
		orpc.admin.marketing.faqs.list.queryOptions(),
	);

	const createMutation = useMutation({
		...orpc.admin.marketing.faqs.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("FAQ created");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to create FAQ"),
	});

	const updateMutation = useMutation({
		...orpc.admin.marketing.faqs.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("FAQ updated");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to update FAQ"),
	});

	const deleteMutation = useMutation({
		...orpc.admin.marketing.faqs.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("FAQ deleted");
		},
		onError: () => toast.error("Failed to delete FAQ"),
	});

	const reorderMutation = useMutation({
		...orpc.admin.marketing.faqs.reorder.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
		},
	});

	const resetForm = () => {
		setFormData({
			question: "",
			answer: "",
			published: true,
			flagged: false,
		});
		setEditingId(null);
	};

	const handleEdit = (faq: {
		id: string;
		question: string;
		answer: string;
		published: boolean;
		flagged: boolean;
	}) => {
		setEditingId(faq.id);
		setFormData({
			question: faq.question,
			answer: faq.answer,
			published: faq.published,
			flagged: faq.flagged,
		});
		setDialogOpen(true);
	};

	const handleSubmit = useCallback(() => {
		if (!formData.question || !formData.answer) {
			toast.error("Please fill in question and answer");
			return;
		}

		if (editingId) {
			updateMutation.mutate({ id: editingId, ...formData });
		} else {
			createMutation.mutate({
				...formData,
				order: faqs?.length || 0,
			});
		}
	}, [formData, editingId, updateMutation, createMutation, faqs]);

	const handleDelete = (id: string) => {
		if (confirm("Are you sure you want to delete this FAQ?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleMove = (id: string, direction: "up" | "down") => {
		if (!faqs) {
			return;
		}
		const index = faqs.findIndex((f: { id: string }) => f.id === id);
		if (index === -1) {
			return;
		}

		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= faqs.length) {
			return;
		}

		const updates = faqs.map((f: { id: string }, i: number) => ({
			id: f.id,
			order: i === index ? newIndex : i === newIndex ? index : i,
		}));

		reorderMutation.mutate({ updates });
	};

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-6">
				<div>
					<p className="text-sm text-muted-foreground">
						Manage the FAQ accordion on the homepage. These answer
						pre-purchase objections.
					</p>
				</div>
				<Button
					onClick={() => {
						resetForm();
						setDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add FAQ
				</Button>
			</div>

			<div className="flex flex-col gap-3">
				{faqs?.map(
					(
						faq: {
							id: string;
							question: string;
							answer: string;
							published: boolean;
							flagged: boolean;
							order: number;
						},
						index: number,
					) => (
						<Card key={faq.id} className="p-4">
							<div className="flex items-start gap-4">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-semibold text-foreground">
											{faq.question}
										</span>
										{faq.flagged && (
											<AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
										)}
									</div>
									<p className="text-sm text-muted-foreground line-clamp-2 mt-1">
										{faq.answer}
									</p>
									<div className="flex items-center gap-2 mt-2">
										{faq.published ? (
											<span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
												Published
											</span>
										) : (
											<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
												Draft
											</span>
										)}
										{faq.flagged && (
											<span className="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded">
												Needs Review
											</span>
										)}
										<span className="text-xs text-muted-foreground">
											Order: {faq.order}
										</span>
									</div>
								</div>
								<div className="flex gap-1 flex-shrink-0">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleMove(faq.id, "up")}
										disabled={index === 0}
									>
										<MoveUp className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											handleMove(faq.id, "down")
										}
										disabled={
											index === (faqs?.length || 0) - 1
										}
									>
										<MoveDown className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleEdit(faq)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleDelete(faq.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</Card>
					),
				)}
				{(!faqs || faqs.length === 0) && (
					<div className="text-center py-12 text-muted-foreground">
						No FAQs yet. Click &quot;Add FAQ&quot; to create one.
					</div>
				)}
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit FAQ" : "Add FAQ"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div>
							<Label htmlFor="question">Question *</Label>
							<Input
								id="question"
								placeholder="What question are visitors asking?"
								value={formData.question}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										question: e.target.value,
									}))
								}
							/>
						</div>

						<div>
							<Label htmlFor="answer">Answer *</Label>
							<Textarea
								id="answer"
								placeholder="Write a clear, helpful answer..."
								value={formData.answer}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										answer: e.target.value,
									}))
								}
								rows={4}
							/>
						</div>

						<div className="flex items-center gap-6">
							<div className="flex items-center gap-2">
								<Switch
									id="faq-published"
									checked={formData.published}
									onCheckedChange={(checked) =>
										setFormData((p) => ({
											...p,
											published: checked,
										}))
									}
								/>
								<Label htmlFor="faq-published">Published</Label>
							</div>
							<div className="flex items-center gap-2">
								<Switch
									id="faq-flagged"
									checked={formData.flagged}
									onCheckedChange={(checked) =>
										setFormData((p) => ({
											...p,
											flagged: checked,
										}))
									}
								/>
								<Label htmlFor="faq-flagged">
									Flag for Review
								</Label>
							</div>
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
									createMutation.isPending ||
									updateMutation.isPending
								}
							>
								{editingId ? "Update" : "Create"} FAQ
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ─── Benefits Tab ───

const ICON_OPTIONS = [
	{ value: "GraduationCap", label: "Graduation Cap", icon: GraduationCap },
	{ value: "Users", label: "Users/Community", icon: Users },
	{ value: "DollarSign", label: "Dollar Sign", icon: DollarSign },
	{ value: "Star", label: "Star", icon: Star },
	{ value: "Heart", label: "Heart", icon: Heart },
	{ value: "Sparkles", label: "Sparkles", icon: Sparkles },
];

function BenefitsTab() {
	const { content, upsertMutation: contentMutation } = useMarketingContent();
	const [benefitsHeadline, setBenefitsHeadline] = useState("");

	useEffect(() => {
		if (content) {
			setBenefitsHeadline(content.benefitsHeadline || "");
		}
	}, [content]);

	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		icon: "GraduationCap",
		heading: "",
		bullets: [""],
		published: true,
	});

	const { data: benefits, isLoading } = useQuery(
		orpc.admin.marketing.benefits.list.queryOptions(),
	);

	const createMutation = useMutation({
		...orpc.admin.marketing.benefits.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Benefit created");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to create benefit"),
	});

	const updateMutation = useMutation({
		...orpc.admin.marketing.benefits.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Benefit updated");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to update benefit"),
	});

	const deleteMutation = useMutation({
		...orpc.admin.marketing.benefits.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Benefit deleted");
		},
		onError: () => toast.error("Failed to delete benefit"),
	});

	const reorderMutation = useMutation({
		...orpc.admin.marketing.benefits.reorder.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
		},
	});

	const resetForm = () => {
		setFormData({
			icon: "GraduationCap",
			heading: "",
			bullets: [""],
			published: true,
		});
		setEditingId(null);
	};

	const handleEdit = (benefit: any) => {
		setEditingId(benefit.id);
		setFormData({
			icon: benefit.icon,
			heading: benefit.heading,
			bullets: benefit.bullets.length > 0 ? benefit.bullets : [""],
			published: benefit.published,
		});
		setDialogOpen(true);
	};

	const handleSubmit = useCallback(() => {
		if (!formData.heading) {
			toast.error("Please enter a heading");
			return;
		}
		const cleanBullets = formData.bullets.filter((b) => b.trim() !== "");
		if (cleanBullets.length === 0) {
			toast.error("Please add at least one bullet point");
			return;
		}
		const payload = { ...formData, bullets: cleanBullets };
		if (editingId) {
			updateMutation.mutate({ id: editingId, ...payload });
		} else {
			createMutation.mutate({ ...payload, order: benefits?.length || 0 });
		}
	}, [formData, editingId, updateMutation, createMutation, benefits]);

	const handleDelete = (id: string) => {
		if (confirm("Delete this benefit?")) {
			deleteMutation.mutate({ id });
		}
	};

	const handleMove = (id: string, direction: "up" | "down") => {
		if (!benefits) {
			return;
		}
		const index = benefits.findIndex((b: any) => b.id === id);
		if (index === -1) {
			return;
		}
		const newIndex = direction === "up" ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= benefits.length) {
			return;
		}
		const updates = benefits.map((b: any, i: number) => ({
			id: b.id,
			order: i === index ? newIndex : i === newIndex ? index : i,
		}));
		reorderMutation.mutate({ updates });
	};

	const addBullet = () =>
		setFormData((p) => ({ ...p, bullets: [...p.bullets, ""] }));
	const removeBullet = (idx: number) =>
		setFormData((p) => ({
			...p,
			bullets: p.bullets.filter((_, i) => i !== idx),
		}));
	const updateBullet = (idx: number, value: string) =>
		setFormData((p) => ({
			...p,
			bullets: p.bullets.map((b, i) => (i === idx ? value : b)),
		}));

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	const getIconComponent = (iconName: string) => {
		const found = ICON_OPTIONS.find((o) => o.value === iconName);
		return found ? found.icon : GraduationCap;
	};

	return (
		<div className="flex flex-col gap-6">
			{/* Section Headline */}
			<Card className="p-4">
				<div className="flex items-end gap-4">
					<div className="flex-1">
						<Label htmlFor="benefitsHeadline">
							Section Headline
						</Label>
						<Input
							id="benefitsHeadline"
							placeholder="What's Included in Your Membership"
							value={benefitsHeadline}
							onChange={(e) =>
								setBenefitsHeadline(e.target.value)
							}
							className="mt-1"
						/>
					</div>
					<Button
						onClick={() =>
							contentMutation.mutate({ benefitsHeadline })
						}
						disabled={contentMutation.isPending}
						size="sm"
					>
						<Save className="mr-2 h-3 w-3" />
						Save
					</Button>
				</div>
			</Card>

			{/* Benefit Cards */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Manage the benefit cards displayed on the homepage. Each
					card shows an icon, heading, and bullet points.
				</p>
				<Button
					onClick={() => {
						resetForm();
						setDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Benefit
				</Button>
			</div>

			<div className="flex flex-col gap-3">
				{benefits?.map((benefit: any, index: number) => {
					const IconComp = getIconComponent(benefit.icon);
					return (
						<Card key={benefit.id} className="p-4">
							<div className="flex items-start gap-4">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
									<IconComp className="h-5 w-5 text-primary" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="font-semibold">
										{benefit.heading}
									</div>
									<div className="text-sm text-muted-foreground mt-1">
										{benefit.bullets.length} bullet point
										{benefit.bullets.length !== 1
											? "s"
											: ""}
									</div>
									<div className="flex items-center gap-2 mt-2">
										{benefit.published ? (
											<span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
												Published
											</span>
										) : (
											<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
												Draft
											</span>
										)}
										<span className="text-xs text-muted-foreground">
											Order: {benefit.order}
										</span>
									</div>
								</div>
								<div className="flex gap-1 flex-shrink-0">
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											handleMove(benefit.id, "up")
										}
										disabled={index === 0}
									>
										<MoveUp className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() =>
											handleMove(benefit.id, "down")
										}
										disabled={
											index ===
											(benefits?.length || 0) - 1
										}
									>
										<MoveDown className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleEdit(benefit)}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleDelete(benefit.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</Card>
					);
				})}
				{(!benefits || benefits.length === 0) && (
					<div className="text-center py-12 text-muted-foreground">
						No benefits yet. Click &quot;Add Benefit&quot; to create
						one.
					</div>
				)}
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{editingId ? "Edit Benefit" : "Add Benefit"}
						</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div>
							<Label htmlFor="b-icon">Icon</Label>
							<Select
								value={formData.icon}
								onValueChange={(value) =>
									setFormData((p) => ({ ...p, icon: value }))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ICON_OPTIONS.map((opt) => (
										<SelectItem
											key={opt.value}
											value={opt.value}
										>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="b-heading">Heading *</Label>
							<Input
								id="b-heading"
								placeholder="Daily Live Training"
								value={formData.heading}
								onChange={(e) =>
									setFormData((p) => ({
										...p,
										heading: e.target.value,
									}))
								}
							/>
						</div>

						<div>
							<Label>Bullet Points *</Label>
							<div className="flex flex-col gap-2 mt-2">
								{formData.bullets.map((bullet, idx) => (
									<div key={idx} className="flex gap-2">
										<Input
											placeholder={`Bullet point ${idx + 1}`}
											value={bullet}
											onChange={(e) =>
												updateBullet(
													idx,
													e.target.value,
												)
											}
										/>
										{formData.bullets.length > 1 && (
											<Button
												size="sm"
												variant="ghost"
												onClick={() =>
													removeBullet(idx)
												}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</div>
								))}
								<Button
									variant="outline"
									size="sm"
									onClick={addBullet}
									className="w-fit"
								>
									<Plus className="mr-2 h-3 w-3" />
									Add Bullet
								</Button>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<Switch
								id="b-published"
								checked={formData.published}
								onCheckedChange={(checked) =>
									setFormData((p) => ({
										...p,
										published: checked,
									}))
								}
							/>
							<Label htmlFor="b-published">Published</Label>
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
									createMutation.isPending ||
									updateMutation.isPending
								}
							>
								{editingId ? "Update" : "Create"} Benefit
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ─── Pricing Tab ───

const PRICING_PLAN_ICON_OPTIONS: {
	value: string;
	label: string;
	Icon: typeof Zap;
}[] = [
	{ value: "Zap", label: "Zap", Icon: Zap },
	{ value: "LightningIcon", label: "Lightning", Icon: LightningIcon },
	{ value: "Star", label: "Star", Icon: Star },
	{ value: "Crown", label: "Crown", Icon: Crown },
	{ value: "Sparkles", label: "Sparkles", Icon: Sparkles },
	{ value: "Wand", label: "Magic Wand", Icon: Wand },
	{ value: "Flame", label: "Flame", Icon: Flame },
	{ value: "Trophy", label: "Trophy", Icon: Trophy },
	{ value: "MedalIcon", label: "Medal", Icon: MedalIcon },
	{ value: "Shield", label: "Shield", Icon: Shield },
	{ value: "ShieldCheck", label: "Shield Check", Icon: ShieldCheck },
	{ value: "Rocket", label: "Rocket", Icon: Rocket },
	{ value: "DollarSign", label: "Dollar Sign", Icon: DollarSign },
	{ value: "Globe", label: "Globe", Icon: Globe },
	{ value: "Heart", label: "Heart", Icon: Heart },
	{ value: "Users", label: "Users", Icon: Users },
	{ value: "Video", label: "Video", Icon: Video },
	{ value: "Play", label: "Play", Icon: Play },
	{ value: "PlayCircle", label: "Play Circle", Icon: PlayCircle },
	{ value: "Headphones", label: "Headphones", Icon: Headphones },
	{ value: "Megaphone", label: "Megaphone", Icon: Megaphone },
	{ value: "Target", label: "Target", Icon: Target },
	{ value: "TrendingUp", label: "Trending Up", Icon: TrendingUp },
	{ value: "Lightbulb", label: "Lightbulb", Icon: Lightbulb },
	{ value: "Gift", label: "Gift", Icon: Gift },
];

interface SortablePlanCardProps {
	plan: any;
	onEdit: (plan: any) => void;
	onDelete: (id: string) => void;
}

function SortablePlanCard({ plan, onEdit, onDelete }: SortablePlanCardProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: plan.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
		zIndex: isDragging ? 10 : undefined,
	};

	return (
		<Card ref={setNodeRef} style={style} className="p-4">
			<div className="flex items-start gap-4">
				<button
					type="button"
					className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
					{...attributes}
					{...listeners}
					aria-label="Drag to reorder"
				>
					<DotsThreeVerticalIcon className="h-5 w-5" />
				</button>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						{plan.icon
							? (() => {
									const opt = PRICING_PLAN_ICON_OPTIONS.find(
										(o) => o.value === plan.icon,
									);
									const ListIcon = opt?.Icon;
									return ListIcon ? (
										<ListIcon className="h-4 w-4 text-primary shrink-0" />
									) : null;
								})()
							: null}
						<span className="font-semibold">{plan.name}</span>
						<span className="text-lg font-bold text-primary">
							{plan.price}
							{plan.period}
						</span>
					</div>
					{plan.subtitle ? (
						<div className="text-sm text-muted-foreground mt-0.5">
							{plan.subtitle}
						</div>
					) : null}
					<div className="text-sm text-muted-foreground mt-1">
						{plan.description}
					</div>
					<div className="text-sm text-muted-foreground mt-1">
						{plan.features.length} feature
						{plan.features.length !== 1 ? "s" : ""} &middot;{" "}
						{plan.checkoutUrl}
						{plan.stripePriceId && (
							<span>
								{" "}
								&middot;{" "}
								<span className="font-mono text-xs">
									{plan.stripePriceId}
								</span>
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 mt-2">
						{plan.published ? (
							<span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
								Published
							</span>
						) : (
							<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
								Draft
							</span>
						)}
						{plan.planType === "promo" && (
							<span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded">
								Promo
							</span>
						)}
						{plan.planType === "lifetime" && (
							<span className="text-xs bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
								Lifetime
							</span>
						)}
						{plan.popular && (
							<span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
								Popular
							</span>
						)}
						{plan.badge && (
							<span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-0.5 rounded">
								{plan.badge}
							</span>
						)}
					</div>
				</div>
				<div className="flex gap-1 flex-shrink-0">
					<Button
						size="sm"
						variant="ghost"
						onClick={() => onEdit(plan)}
					>
						<Pencil className="h-4 w-4" />
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => onDelete(plan.id)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
		</Card>
	);
}

function PricingTab() {
	const { content, upsertMutation: contentMutation } = useMarketingContent();
	const [pricingHeader, setPricingHeader] = useState({
		pricingBadgeText: "",
		pricingHeadline: "",
		pricingSubheadline: "",
	});

	useEffect(() => {
		if (content) {
			setPricingHeader({
				pricingBadgeText: content.pricingBadgeText || "",
				pricingHeadline: content.pricingHeadline || "",
				pricingSubheadline: content.pricingSubheadline || "",
			});
		}
	}, [content]);

	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		name: "",
		price: "",
		period: "/month",
		subtitle: "",
		description: "",
		features: [""],
		ctaText: "Get Started",
		checkoutUrl: "",
		stripePriceId: "",
		planType: "standard" as "standard" | "promo" | "lifetime",
		popular: false,
		badge: "",
		icon: "",
		discordRoleEnvKey: "",
		allowPromoCodes: false,
		inheritsFrom: "",
		compareAtPrice: "",
		trustText: "",
		published: true,
	});

	const { data: serverPlans, isLoading } = useQuery(
		orpc.admin.marketing.pricing.list.queryOptions(),
	);
	const [localPlans, setLocalPlans] = useState<any[] | null>(null);
	const plans = localPlans ?? serverPlans;

	const createMutation = useMutation({
		...orpc.admin.marketing.pricing.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Pricing plan created");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to create pricing plan"),
	});

	const updateMutation = useMutation({
		...orpc.admin.marketing.pricing.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Pricing plan updated");
			setDialogOpen(false);
			resetForm();
		},
		onError: () => toast.error("Failed to update pricing plan"),
	});

	const deleteMutation = useMutation({
		...orpc.admin.marketing.pricing.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["marketing"] });
			clearMarketingCache();
			toast.success("Pricing plan deleted");
		},
		onError: () => toast.error("Failed to delete pricing plan"),
	});

	const pricingListQueryOptions =
		orpc.admin.marketing.pricing.list.queryOptions();

	const reorderMutation = useMutation({
		...orpc.admin.marketing.pricing.reorder.mutationOptions(),
		onSuccess: () => {
			clearMarketingCache();
			setLocalPlans(null);
		},
		onError: () => {
			setLocalPlans(null);
			queryClient.invalidateQueries(pricingListQueryOptions);
			toast.error("Failed to reorder plans");
		},
	});

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id || !plans) {
			return;
		}
		const oldIndex = plans.findIndex((p: any) => p.id === active.id);
		const newIndex = plans.findIndex((p: any) => p.id === over.id);
		if (oldIndex === -1 || newIndex === -1) {
			return;
		}
		const reordered = [...plans];
		const [moved] = reordered.splice(oldIndex, 1);
		reordered.splice(newIndex, 0, moved);
		setLocalPlans(reordered);
		queryClient.setQueryData(pricingListQueryOptions.queryKey, reordered);
		const updates = reordered.map((p: any, i: number) => ({
			id: p.id,
			order: i,
		}));
		reorderMutation.mutate({ updates });
	};

	const resetForm = () => {
		setFormData({
			name: "",
			price: "",
			period: "/month",
			subtitle: "",
			description: "",
			features: [""],
			ctaText: "Get Started",
			checkoutUrl: "",
			stripePriceId: "",
			planType: "standard",
			popular: false,
			badge: "",
			icon: "",
			discordRoleEnvKey: "",
			allowPromoCodes: false,
			inheritsFrom: "",
			compareAtPrice: "",
			trustText: "",
			published: true,
		});
		setEditingId(null);
	};

	const handleEdit = (plan: any) => {
		setEditingId(plan.id);
		setFormData({
			name: plan.name,
			price: plan.price,
			period: plan.period,
			subtitle: plan.subtitle || "",
			description: plan.description,
			features: plan.features.length > 0 ? plan.features : [""],
			ctaText: plan.ctaText,
			checkoutUrl: plan.checkoutUrl,
			stripePriceId: plan.stripePriceId || "",
			planType: plan.planType || "standard",
			popular: plan.popular,
			badge: plan.badge || "",
			icon: plan.icon || "",
			discordRoleEnvKey: plan.discordRoleEnvKey || "",
			allowPromoCodes: plan.allowPromoCodes ?? false,
			inheritsFrom: plan.inheritsFrom || "",
			compareAtPrice: plan.compareAtPrice || "",
			trustText: plan.trustText || "",
			published: plan.published,
		} as typeof formData);
		setDialogOpen(true);
	};

	const handleSubmit = useCallback(() => {
		if (!formData.name || !formData.price || !formData.checkoutUrl) {
			toast.error("Please fill in name, price, and checkout URL");
			return;
		}
		if (!formData.stripePriceId) {
			toast.error("A Stripe Price ID is required for all plans");
			return;
		}
		const cleanFeatures = formData.features.filter((f) => f.trim() !== "");
		const payload = {
			...formData,
			features: cleanFeatures,
			subtitle: formData.subtitle.trim() || null,
			badge: formData.badge || null,
			stripePriceId: formData.stripePriceId || null,
			icon: formData.icon.trim() ? formData.icon.trim() : null,
			discordRoleEnvKey: formData.discordRoleEnvKey.trim()
				? formData.discordRoleEnvKey.trim()
				: null,
			inheritsFrom: formData.inheritsFrom.trim() || null,
			compareAtPrice: formData.compareAtPrice.trim() || null,
			trustText: formData.trustText.trim() || null,
		};
		if (editingId) {
			updateMutation.mutate({ id: editingId, ...payload });
		} else {
			createMutation.mutate({ ...payload, order: plans?.length || 0 });
		}
	}, [formData, editingId, updateMutation, createMutation, plans]);

	const handleDelete = (id: string) => {
		if (confirm("Delete this pricing plan?")) {
			deleteMutation.mutate({ id });
		}
	};

	const previewPlan = useMemo((): PricingPlan => {
		const features = formData.features
			.map((f) => f.trim())
			.filter((f) => f.length > 0);
		return {
			name: formData.name || "Plan name",
			price: formData.price || "$—",
			period: formData.period,
			description: formData.description,
			subtitle: formData.subtitle.trim() || null,
			features: features.length > 0 ? features : ["(no features yet)"],
			ctaText: formData.ctaText || "Get Started",
			popular: formData.popular,
			badge: formData.badge.trim() || null,
			checkoutUrl: formData.checkoutUrl || "#",
			stripePriceId: formData.stripePriceId || null,
			planType: formData.planType,
			icon: formData.icon.trim() || null,
			allowPromoCodes: formData.allowPromoCodes,
			inheritsFrom: formData.inheritsFrom.trim() || null,
			compareAtPrice: formData.compareAtPrice.trim() || null,
			trustText: formData.trustText.trim() || null,
		};
	}, [formData]);

	const addFeature = () =>
		setFormData((p) => ({ ...p, features: [...p.features, ""] }));
	const removeFeature = (idx: number) =>
		setFormData((p) => ({
			...p,
			features: p.features.filter((_, i) => i !== idx),
		}));
	const updateFeature = (idx: number, value: string) =>
		setFormData((p) => ({
			...p,
			features: p.features.map((f, i) => (i === idx ? value : f)),
		}));

	if (isLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{/* Section Header Copy */}
			<Card className="p-4">
				<div className="flex flex-col gap-3">
					<div>
						<Label htmlFor="pricingBadgeText">Badge Text</Label>
						<Input
							id="pricingBadgeText"
							placeholder="Simple Pricing"
							value={pricingHeader.pricingBadgeText}
							onChange={(e) =>
								setPricingHeader((p) => ({
									...p,
									pricingBadgeText: e.target.value,
								}))
							}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="pricingHeadline">
							Section Headline
						</Label>
						<Input
							id="pricingHeadline"
							placeholder="Choose Your Plan"
							value={pricingHeader.pricingHeadline}
							onChange={(e) =>
								setPricingHeader((p) => ({
									...p,
									pricingHeadline: e.target.value,
								}))
							}
							className="mt-1"
						/>
					</div>
					<div>
						<Label htmlFor="pricingSubheadline">
							Section Subheadline
						</Label>
						<Textarea
							id="pricingSubheadline"
							placeholder="Start building your creator empire today..."
							value={pricingHeader.pricingSubheadline}
							onChange={(e) =>
								setPricingHeader((p) => ({
									...p,
									pricingSubheadline: e.target.value,
								}))
							}
							rows={2}
							className="mt-1"
						/>
					</div>
					<div className="flex justify-end">
						<Button
							onClick={() =>
								contentMutation.mutate(pricingHeader)
							}
							disabled={contentMutation.isPending}
							size="sm"
						>
							<Save className="mr-2 h-3 w-3" />
							Save Header
						</Button>
					</div>
				</div>
			</Card>

			{/* Plans */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Manage pricing plans displayed on the homepage. Toggle plans
					on/off during promotions.
				</p>
				<Button
					onClick={() => {
						resetForm();
						setDialogOpen(true);
					}}
				>
					<Plus className="mr-2 h-4 w-4" />
					Add Plan
				</Button>
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<SortableContext
					items={plans?.map((p: any) => p.id) ?? []}
					strategy={verticalListSortingStrategy}
				>
					<div className="flex flex-col gap-3">
						{plans?.map((plan: any) => (
							<SortablePlanCard
								key={plan.id}
								plan={plan}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
						{(!plans || plans.length === 0) && (
							<div className="text-center py-12 text-muted-foreground">
								No pricing plans yet. Click &quot;Add Plan&quot;
								to create one.
							</div>
						)}
					</div>
				</SortableContext>
			</DndContext>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="flex max-h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1024px,95vw)]">
					<DialogHeader className="shrink-0 px-6 pb-2 pt-6">
						<DialogTitle>
							{editingId ? "Edit Plan" : "Add Plan"}
						</DialogTitle>
					</DialogHeader>
					<div className="grid min-h-0 flex-1 grid-cols-1 border-t lg:grid-cols-[minmax(0,1fr)_340px]">
						<div className="flex max-h-[calc(90vh-8rem)] flex-col gap-4 overflow-y-auto px-6 py-4">
							{/* Plan Type */}
							<div>
								<Label htmlFor="p-type">Plan Type</Label>
								<Select
									value={formData.planType}
									onValueChange={(
										value:
											| "standard"
											| "promo"
											| "lifetime",
									) => {
										setFormData((p) => ({
											...p,
											planType: value,
											checkoutUrl:
												value === "promo"
													? "/checkout/promo"
													: value === "lifetime"
														? "/checkout/lifetime"
														: p.checkoutUrl,
										}));
									}}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="standard">
											Standard (Monthly/Yearly)
										</SelectItem>
										<SelectItem value="promo">
											Promotional
										</SelectItem>
										<SelectItem value="lifetime">
											Lifetime
										</SelectItem>
									</SelectContent>
								</Select>
								<p className="text-xs text-muted-foreground mt-1">
									All plans require a Stripe Price ID. Promo
									and Lifetime plans use fixed checkout
									routes.
								</p>
							</div>

							<div>
								<Label htmlFor="p-name">Plan Name *</Label>
								<Input
									id="p-name"
									placeholder="Monthly"
									value={formData.name}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											name: e.target.value,
										}))
									}
									className="mt-1"
								/>
							</div>
							<div>
								<Label htmlFor="p-subtitle">Subtitle</Label>
								<Input
									id="p-subtitle"
									placeholder="For beginners"
									value={formData.subtitle}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											subtitle: e.target.value,
										}))
									}
									className="mt-1"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Short persona label (2–4 words). Renders
									under the plan name on the public card.
								</p>
							</div>
							<div>
								<Label htmlFor="p-badge">Badge</Label>
								<Input
									id="p-badge"
									placeholder="BEST VALUE (or leave empty)"
									value={formData.badge}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											badge: e.target.value,
										}))
									}
									className="mt-1"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Optional for non-popular plans (e.g. BEST
									VALUE). Renders as an inline pill next to
									the plan name. Ignored when
									&quot;Popular&quot; is on — the popular tier
									shows the floating Most Popular pill
									instead.
								</p>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="p-price">
										Display Price *
									</Label>
									<Input
										id="p-price"
										placeholder="$99"
										value={formData.price}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												price: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label htmlFor="p-period">Period</Label>
									<Select
										value={formData.period}
										onValueChange={(value) =>
											setFormData((p) => ({
												...p,
												period: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="/month">
												/month
											</SelectItem>
											<SelectItem value="/year">
												/year
											</SelectItem>
											<SelectItem value="/day">
												/day
											</SelectItem>
											<SelectItem value=" one-time">
												one-time
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div>
								<Label htmlFor="p-description">
									Description * (internal reference)
								</Label>
								<Textarea
									id="p-description"
									placeholder="Perfect for getting started..."
									value={formData.description}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											description: e.target.value,
										}))
									}
									rows={2}
									className="mt-1"
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									Not shown on the public pricing card. Use
									for admin notes or future channels.
								</p>
							</div>

							<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
								<Label
									htmlFor="p-stripe"
									className="text-amber-600 dark:text-amber-400"
								>
									Stripe Price ID *
								</Label>
								<Input
									id="p-stripe"
									placeholder="price_1Abc123..."
									value={formData.stripePriceId}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											stripePriceId: e.target.value,
										}))
									}
									className="mt-2 font-mono"
								/>
								<p className="text-xs text-muted-foreground mt-2">
									Copy from Stripe Dashboard &rarr; Products
									&rarr; Select product &rarr; Price ID. This
									is what gets charged.
								</p>
							</div>

							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<Label htmlFor="p-icon">Card icon</Label>
									<Select
										value={formData.icon || "__default__"}
										onValueChange={(value) =>
											setFormData((p) => ({
												...p,
												icon:
													value === "__default__"
														? ""
														: value,
											}))
										}
									>
										<SelectTrigger
											id="p-icon"
											className="mt-1"
										>
											<SelectValue placeholder="Choose icon" />
										</SelectTrigger>
										<SelectContent className="max-h-64 overflow-y-auto">
											<SelectItem value="__default__">
												Default (Crown / Zap on site)
											</SelectItem>
											{PRICING_PLAN_ICON_OPTIONS.map(
												({ value, label, Icon }) => (
													<SelectItem
														key={value}
														value={value}
													>
														<span className="flex items-center gap-2">
															<Icon className="h-4 w-4 shrink-0" />
															{label}
														</span>
													</SelectItem>
												),
											)}
										</SelectContent>
									</Select>
									{formData.icon ? (
										<p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
											Preview: {(() => {
												const opt =
													PRICING_PLAN_ICON_OPTIONS.find(
														(o) =>
															o.value ===
															formData.icon,
													);
												const PreviewIcon =
													opt?.Icon ?? Zap;
												return (
													<PreviewIcon className="h-4 w-4 text-primary" />
												);
											})()}
										</p>
									) : null}
								</div>
								<div>
									<Label htmlFor="p-discord-role">
										Discord role
									</Label>
									<Select
										value={
											formData.discordRoleEnvKey ||
											"__none__"
										}
										onValueChange={(value) =>
											setFormData((p) => ({
												...p,
												discordRoleEnvKey:
													value === "__none__"
														? ""
														: value,
											}))
										}
									>
										<SelectTrigger
											id="p-discord-role"
											className="mt-1"
										>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">
												None (falls back to Active)
											</SelectItem>
											<SelectItem value="DISCORD_ACTIVE_ROLE_ID">
												Active (generic)
											</SelectItem>
											<SelectItem value="DISCORD_STARTER_ROLE_ID">
												Starter Role
											</SelectItem>
											<SelectItem value="DISCORD_CREATOR_ROLE_ID">
												Creator Role
											</SelectItem>
											<SelectItem value="DISCORD_STREAMER_ROLE_ID">
												Streamer Role
											</SelectItem>
											<SelectItem value="DISCORD_PARTNER_ROLE_ID">
												Partner Role
											</SelectItem>
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground mt-2">
										Maps to env vars on the server (
										<code className="text-[10px]">
											DISCORD_*_ROLE_ID
										</code>
										).
									</p>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="p-cta">Button Text</Label>
									<Input
										id="p-cta"
										placeholder="Get Started"
										value={formData.ctaText}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												ctaText: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label htmlFor="p-checkout">
										Checkout URL *
									</Label>
									<Input
										id="p-checkout"
										placeholder={
											formData.planType === "promo"
												? "/checkout/promo"
												: formData.planType ===
														"lifetime"
													? "/checkout/lifetime"
													: "/checkout/starter-monthly"
										}
										value={formData.checkoutUrl}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												checkoutUrl: e.target.value,
											}))
										}
										disabled={
											formData.planType === "promo" ||
											formData.planType === "lifetime"
										}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										{formData.planType === "promo"
											? "Promo plans always use /checkout/promo"
											: formData.planType === "lifetime"
												? "Lifetime plans always use /checkout/lifetime"
												: "Path must match /checkout/{slug} — e.g. /checkout/starter-monthly"}
									</p>
								</div>
							</div>

							<div>
								<Label htmlFor="p-inherits-from">
									Inherits From (Feature Comparison)
								</Label>
								<Input
									id="p-inherits-from"
									placeholder="Starter (shows: Everything in Starter, plus…)"
									value={formData.inheritsFrom}
									onChange={(e) =>
										setFormData((p) => ({
											...p,
											inheritsFrom: e.target.value,
										}))
									}
								/>
								<p className="text-xs text-muted-foreground mt-1">
									The plan name this tier builds on. Leave
									blank to show a plain feature list.
								</p>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor="p-compare-price">
										Compare-At Price
									</Label>
									<Input
										id="p-compare-price"
										placeholder="$149 (shows crossed out)"
										value={formData.compareAtPrice}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												compareAtPrice: e.target.value,
											}))
										}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Original price to show struck through
									</p>
								</div>
								<div>
									<Label htmlFor="p-trust-text">
										Trust Micro-Copy
									</Label>
									<Input
										id="p-trust-text"
										placeholder="No contracts · Cancel anytime"
										value={formData.trustText}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												trustText: e.target.value,
											}))
										}
									/>
									<p className="text-xs text-muted-foreground mt-1">
										Short trust copy (e.g. &quot;No
										contracts&quot;). Renders directly under
										the price on the card.
									</p>
								</div>
							</div>

							<div>
								<Label>Features</Label>
								<p className="mt-1 text-xs text-muted-foreground">
									Recommended: 4–6 features. Cards render at
									~280px wide on laptops; keep copy concise.
								</p>
								<div className="mt-2 flex flex-col gap-2">
									{formData.features.map((feature, idx) => (
										<div key={idx} className="flex gap-2">
											<Input
												placeholder={`Feature ${idx + 1}`}
												value={feature}
												onChange={(e) =>
													updateFeature(
														idx,
														e.target.value,
													)
												}
											/>
											{formData.features.length > 1 && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() =>
														removeFeature(idx)
													}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											)}
										</div>
									))}
									<Button
										variant="outline"
										size="sm"
										onClick={addFeature}
										className="w-fit"
									>
										<Plus className="mr-2 h-3 w-3" />
										Add Feature
									</Button>
								</div>
							</div>

							<div className="flex flex-wrap items-center gap-6">
								<div className="flex items-center gap-2">
									<Switch
										id="p-popular"
										checked={formData.popular}
										onCheckedChange={(checked) =>
											setFormData((p) => ({
												...p,
												popular: checked,
											}))
										}
									/>
									<Label htmlFor="p-popular">
										Mark as Popular
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										id="p-promo-codes"
										checked={formData.allowPromoCodes}
										onCheckedChange={(checked) =>
											setFormData((p) => ({
												...p,
												allowPromoCodes: checked,
											}))
										}
									/>
									<Label htmlFor="p-promo-codes">
										Allow Promo Codes
									</Label>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										id="p-published"
										checked={formData.published}
										onCheckedChange={(checked) =>
											setFormData((p) => ({
												...p,
												published: checked,
											}))
										}
									/>
									<Label htmlFor="p-published">
										Published
									</Label>
								</div>
							</div>
						</div>

						<div className="hidden max-h-[calc(90vh-8rem)] flex-col overflow-y-auto border-l bg-muted/15 p-4 lg:flex">
							<p className="mb-3 text-sm font-medium">
								Live preview
							</p>
							<div className="flex justify-center">
								<PricingCardPreview plan={previewPlan} />
							</div>
							<aside className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
								<p className="mb-1 font-medium text-foreground">
									Automatic (not configurable):
								</p>
								<ul className="list-disc space-y-0.5 pl-4">
									<li>
										Most Popular pill + gradient glow (when
										Popular is on)
									</li>
									<li>
										Hover spotlight dimming of sibling cards
										(desktop)
									</li>
									<li>
										Price number animation on scroll into
										view
									</li>
									<li>
										Card layout, icon position, CTA position
									</li>
								</ul>
							</aside>
						</div>
					</div>

					<div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
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
								createMutation.isPending ||
								updateMutation.isPending
							}
						>
							{editingId ? "Update" : "Create"} Plan
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ─── Testimonials Tab ───

function TestimonialsTab() {
	const {
		content,
		isLoading: isContentLoading,
		upsertMutation,
	} = useMarketingContent();
	const [sectionForm, setSectionForm] = useState({
		testimonialsBadgeText: "",
		testimonialsHeadline: "",
		testimonialsHeadlineAccent: "",
		testimonialsSubheadline: "",
	});

	useEffect(() => {
		if (content) {
			setSectionForm({
				testimonialsBadgeText: content.testimonialsBadgeText || "",
				testimonialsHeadline: content.testimonialsHeadline || "",
				testimonialsHeadlineAccent:
					content.testimonialsHeadlineAccent || "",
				testimonialsSubheadline: content.testimonialsSubheadline || "",
			});
		}
	}, [content]);

	const handleSectionSave = useCallback(() => {
		upsertMutation.mutate(sectionForm);
	}, [sectionForm, upsertMutation]);

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

	const { data: testimonials, isLoading } = useQuery(
		orpc.admin.testimonials.list.queryOptions(),
	);

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
		onError: () => toast.error("Failed to create testimonial"),
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
		onError: () => toast.error("Failed to update testimonial"),
	});

	const deleteMutation = useMutation({
		...orpc.admin.testimonials.delete.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["testimonials-admin"] });
			queryClient.invalidateQueries({ queryKey: ["testimonials"] });
			toast.success("Testimonial deleted successfully");
		},
		onError: () => toast.error("Failed to delete testimonial"),
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
			const MAX_SIZE = 5 * 1024 * 1024;

			if (file.size > MAX_SIZE) {
				toast.error("Image too large", {
					description:
						"Maximum file size is 5MB. Please choose a smaller image.",
				});
				return;
			}

			const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
			if (!allowedTypes.includes(file.type)) {
				toast.error("Invalid file type", {
					description: "Please upload a PNG, JPG, or JPEG image.",
				});
				return;
			}

			setUploading(true);
			try {
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
		maxSize: 5 * 1024 * 1024,
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

		if (editingId) {
			updateMutation.mutate({ id: editingId, ...formData });
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

	if (isLoading || isContentLoading) {
		return (
			<div className="text-center py-12 text-muted-foreground">
				Loading...
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<Star className="h-5 w-5 text-primary" />
						<CardTitle>Section Header</CardTitle>
					</div>
					<CardDescription>
						The badge, headline, and description above the
						testimonial cards
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor="testimonialsBadgeText">
							Badge Text
						</Label>
						<Input
							id="testimonialsBadgeText"
							placeholder="Success Stories"
							value={sectionForm.testimonialsBadgeText}
							onChange={(e) =>
								setSectionForm((p) => ({
									...p,
									testimonialsBadgeText: e.target.value,
								}))
							}
						/>
					</div>
					<div>
						<Label htmlFor="testimonialsHeadline">Headline</Label>
						<Input
							id="testimonialsHeadline"
							placeholder="Real Creators, Real Results"
							value={sectionForm.testimonialsHeadline}
							onChange={(e) =>
								setSectionForm((p) => ({
									...p,
									testimonialsHeadline: e.target.value,
								}))
							}
						/>
					</div>
					<div>
						<Label htmlFor="testimonialsHeadlineAccent">
							Headline Accent (Orange Text)
						</Label>
						<Input
							id="testimonialsHeadlineAccent"
							placeholder="Real Results"
							value={sectionForm.testimonialsHeadlineAccent}
							onChange={(e) =>
								setSectionForm((p) => ({
									...p,
									testimonialsHeadlineAccent: e.target.value,
								}))
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							The exact phrase from your headline to display in
							orange. Leave blank to auto-highlight the last word.
						</p>
					</div>
					<div>
						<Label htmlFor="testimonialsSubheadline">
							Subheadline
						</Label>
						<Textarea
							id="testimonialsSubheadline"
							placeholder="Join thousands of creators who..."
							value={sectionForm.testimonialsSubheadline}
							onChange={(e) =>
								setSectionForm((p) => ({
									...p,
									testimonialsSubheadline: e.target.value,
								}))
							}
							rows={3}
						/>
					</div>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					onClick={handleSectionSave}
					disabled={upsertMutation.isPending}
					size="lg"
				>
					<Save className="mr-2 h-4 w-4" />
					{upsertMutation.isPending ? "Saving..." : "Save Changes"}
				</Button>
			</div>

			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Manage customer success stories and testimonials displayed
					on the homepage.
				</p>
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

			<div className="flex flex-col gap-3">
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
									{testimonial.role} &middot;{" "}
									{testimonial.stats}
								</div>
								<div className="text-sm text-muted-foreground line-clamp-1 mt-1">
									{testimonial.content}
								</div>
								<div className="flex items-center gap-2 mt-2">
									{testimonial.published ? (
										<span className="text-xs bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded">
											Published
										</span>
									) : (
										<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
											Draft
										</span>
									)}
									<span className="text-xs text-muted-foreground">
										Order: {testimonial.order}
									</span>
								</div>
							</div>
							<div className="flex gap-1 flex-shrink-0">
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
						No testimonials yet. Click &quot;Add Testimonial&quot;
						to create one.
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
					<div className="flex flex-col gap-4">
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
								Requirements: PNG, JPG, or JPEG &middot; Max 5MB
								&middot; Square images recommended
							</p>
						</div>

						<div>
							<Label htmlFor="t-name">Name *</Label>
							<Input
								id="t-name"
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
							<Label htmlFor="t-role">Role *</Label>
							<Input
								id="t-role"
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
							<Label htmlFor="t-stats">Stats *</Label>
							<Input
								id="t-stats"
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
							<Label htmlFor="t-rating">Rating</Label>
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
							<Label htmlFor="t-content">Content *</Label>
							<Textarea
								id="t-content"
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
								id="t-published"
								checked={formData.published}
								onCheckedChange={(checked) =>
									setFormData((p) => ({
										...p,
										published: checked,
									}))
								}
							/>
							<Label htmlFor="t-published">Published</Label>
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

// ─── Main Page ───

const VALID_TABS = [
	"hero",
	"benefits",
	"pricing",
	"faqs",
	"testimonials",
	"ctas",
	"affiliate",
	"seo",
] as const;

export default function AdminMarketingPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const rawTab = searchParams.get("tab") ?? "hero";
	const activeTab = (VALID_TABS as readonly string[]).includes(rawTab)
		? rawTab
		: "hero";

	const handleTabChange = (value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("tab", value);
		router.replace(`?${params.toString()}`, { scroll: false });
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight text-balance">
					Marketing Management
				</h1>
				<p className="text-muted-foreground mt-2 text-pretty">
					Manage all homepage sections: hero, benefits, pricing, FAQs,
					testimonials, and SEO. Changes are saved to the database and
					take effect immediately.
				</p>
			</div>

			<Tabs
				value={activeTab}
				onValueChange={handleTabChange}
				className="w-full"
			>
				<TabsList className="flex-wrap">
					<TabsTrigger value="hero" className="gap-2">
						<Play className="h-4 w-4" />
						Hero
					</TabsTrigger>
					<TabsTrigger value="benefits" className="gap-2">
						<Star className="h-4 w-4" />
						Benefits
					</TabsTrigger>
					<TabsTrigger value="pricing" className="gap-2">
						<CreditCard className="h-4 w-4" />
						Pricing
					</TabsTrigger>
					<TabsTrigger value="faqs" className="gap-2">
						<HelpCircle className="h-4 w-4" />
						FAQs
					</TabsTrigger>
					<TabsTrigger value="testimonials" className="gap-2">
						<MessageSquareQuote className="h-4 w-4" />
						Testimonials
					</TabsTrigger>
					<TabsTrigger value="ctas" className="gap-2">
						<Sparkles className="h-4 w-4" />
						CTAs
					</TabsTrigger>
					<TabsTrigger value="affiliate" className="gap-2">
						<Link2 className="h-4 w-4" />
						Affiliate
					</TabsTrigger>
					<TabsTrigger value="seo" className="gap-2">
						<Globe className="h-4 w-4" />
						SEO
					</TabsTrigger>
				</TabsList>

				<TabsContent value="hero" className="mt-6">
					<HeroTab />
				</TabsContent>

				<TabsContent value="benefits" className="mt-6">
					<BenefitsTab />
				</TabsContent>

				<TabsContent value="pricing" className="mt-6">
					<PricingTab />
				</TabsContent>

				<TabsContent value="faqs" className="mt-6">
					<FaqsTab />
				</TabsContent>

				<TabsContent value="testimonials" className="mt-6">
					<TestimonialsTab />
				</TabsContent>

				<TabsContent value="ctas" className="mt-6">
					<CtasTab />
				</TabsContent>

				<TabsContent value="affiliate" className="mt-6">
					<AffiliateTab />
				</TabsContent>

				<TabsContent value="seo" className="mt-6">
					<SeoTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
