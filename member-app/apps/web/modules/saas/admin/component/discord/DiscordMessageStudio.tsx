"use client";

import type {
	MessageStudioEmbedField,
	MessageStudioPayload,
} from "@repo/discord";
import { orpcClient } from "@shared/lib/orpc-client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ui/components/tabs";
import { Textarea } from "@ui/components/textarea";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	AlertTriangle,
	Loader2,
	MessageSquarePlus,
	Trash2,
} from "@/modules/ui/icons";

function getErrorMessage(error: unknown): string {
	if (error && typeof error === "object" && "message" in error) {
		const m = (error as { message: unknown }).message;
		if (typeof m === "string") {
			return m;
		}
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Something went wrong";
}

function emptyPayload(): MessageStudioPayload {
	return {
		content: "",
		embed: null,
		linkButtons: [],
		actionPreset: "none",
		presetButtonLabel: "",
	};
}

function parseColorInput(raw: string): number | undefined {
	const t = raw.trim();
	if (!t) {
		return undefined;
	}
	if (t.startsWith("#")) {
		const hex = t.slice(1);
		if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
			return undefined;
		}
		const n = Number.parseInt(hex, 16);
		return Number.isFinite(n) ? n : undefined;
	}
	const n = Number.parseInt(t, 10);
	if (!Number.isFinite(n) || n < 0) {
		return undefined;
	}
	return n;
}

function formatColorHex(color?: number): string {
	if (color === undefined || color === null) {
		return "";
	}
	return `#${color.toString(16).padStart(6, "0")}`;
}

/** Resolved from `document` — matches `tooling/tailwind/theme.css` `:root` / `.dark` `--primary` when set as #hex. */
function getCssPrimaryHex(): string {
	if (typeof document === "undefined") {
		return "#e8650a";
	}
	const raw = getComputedStyle(document.documentElement)
		.getPropertyValue("--primary")
		.trim();
	if (/^#[0-9a-fA-F]{6}$/i.test(raw)) {
		return `#${raw.slice(1).toLowerCase()}`;
	}
	// Fallback if theme uses non-hex (should not happen with current theme.css)
	return "#e8650a";
}

export function DiscordMessageStudio() {
	const queryClient = useQueryClient();
	const [mode, setMode] = useState<"create" | "edit">("create");
	const [templateId, setTemplateId] = useState<string | null>(null);
	const [templateName, setTemplateName] = useState("Untitled template");
	const [selectedChannelId, setSelectedChannelId] = useState("");
	const [channelIdOverride, setChannelIdOverride] = useState("");
	const [messageId, setMessageId] = useState<string | null>(null);
	const [messageLinkInput, setMessageLinkInput] = useState("");
	const [payload, setPayload] = useState<MessageStudioPayload>(emptyPayload);
	const [embedEnabled, setEmbedEnabled] = useState(false);
	const [colorHex, setColorHex] = useState("");
	const [authorMatchesBot, setAuthorMatchesBot] = useState<boolean | null>(
		null,
	);
	const [duplicateOpen, setDuplicateOpen] = useState(false);
	const [duplicateName, setDuplicateName] = useState("");
	const [nonBotConfirmOpen, setNonBotConfirmOpen] = useState(false);

	const effectiveChannelId = channelIdOverride.trim() || selectedChannelId;

	const channelsQuery = useQuery(
		orpc.admin.discord.messageStudio.listChannels.queryOptions(),
	);
	const templatesQuery = useQuery(
		orpc.admin.discord.messageStudio.listTemplates.queryOptions(),
	);

	const invalidateTemplates = useCallback(() => {
		void queryClient.invalidateQueries({
			queryKey: orpc.admin.discord.messageStudio.listTemplates.key(),
		});
	}, [queryClient]);

	const applyPayloadFromTemplate = useCallback(
		(data: {
			name: string;
			channelId: string;
			messageId: string | null;
			payload: MessageStudioPayload;
		}) => {
			setTemplateName(data.name);
			setSelectedChannelId(data.channelId);
			setChannelIdOverride("");
			setMessageId(data.messageId);
			setPayload({
				...data.payload,
				linkButtons: data.payload.linkButtons ?? [],
			});
			const emb = data.payload.embed;
			const hasEmbed = Boolean(emb && Object.keys(emb).length > 0);
			setEmbedEnabled(hasEmbed);
			setColorHex(formatColorHex(emb?.color));
			setAuthorMatchesBot(null);
			if (data.messageId) {
				setMode("edit");
			}
		},
		[],
	);

	const loadTemplateMutation = useMutation({
		mutationFn: async (id: string) => {
			return orpcClient.admin.discord.messageStudio.getTemplate({ id });
		},
		onSuccess: (data) => {
			setTemplateId(data.id);
			applyPayloadFromTemplate({
				name: data.name,
				channelId: data.channelId,
				messageId: data.messageId,
				payload: data.payload as MessageStudioPayload,
			});
			toast.success("Template loaded");
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const postMutation = useMutation({
		mutationFn: async () => {
			return orpcClient.admin.discord.messageStudio.postMessage({
				channelId: effectiveChannelId,
				payload: payload as never,
			});
		},
		onSuccess: (data) => {
			setMessageId(data.messageId);
			setMode("edit");
			toast.success("Message posted");
			invalidateTemplates();
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const patchMutation = useMutation({
		mutationFn: async (confirmNonBotAuthor?: boolean) => {
			if (!messageId || !effectiveChannelId) {
				throw new Error(
					"Channel and message ID are required to update",
				);
			}
			return orpcClient.admin.discord.messageStudio.patchMessage({
				channelId: effectiveChannelId,
				messageId,
				payload: payload as never,
				confirmNonBotAuthor,
			});
		},
		onSuccess: () => {
			toast.success("Message updated in Discord");
			setNonBotConfirmOpen(false);
			invalidateTemplates();
		},
		onError: (e) => {
			const msg = getErrorMessage(e);
			if (msg.startsWith("AUTHOR_NOT_BOT:")) {
				setNonBotConfirmOpen(true);
				return;
			}
			toast.error(msg);
		},
	});

	const deleteDiscordMutation = useMutation({
		mutationFn: async () => {
			if (!messageId || !effectiveChannelId) {
				throw new Error("Nothing to delete");
			}
			return orpcClient.admin.discord.messageStudio.deleteDiscordMessage({
				channelId: effectiveChannelId,
				messageId,
			});
		},
		onSuccess: () => {
			toast.success("Message deleted in Discord");
			setMessageId(null);
			invalidateTemplates();
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const saveTemplateMutation = useMutation({
		mutationFn: async () => {
			return orpcClient.admin.discord.messageStudio.saveTemplate({
				id: templateId ?? undefined,
				name: templateName,
				channelId: effectiveChannelId,
				messageId: messageId ?? undefined,
				payload: payload as never,
			});
		},
		onSuccess: (data) => {
			setTemplateId(data.id);
			toast.success("Template saved");
			invalidateTemplates();
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const duplicateMutation = useMutation({
		mutationFn: async () => {
			if (!templateId) {
				throw new Error("Select a template first");
			}
			return orpcClient.admin.discord.messageStudio.duplicateTemplate({
				id: templateId,
				name: duplicateName.trim(),
			});
		},
		onSuccess: (data) => {
			setTemplateId(data.id);
			setMessageId(null);
			setTemplateName(duplicateName.trim());
			setDuplicateOpen(false);
			setDuplicateName("");
			toast.success("Template duplicated (message ID cleared)");
			invalidateTemplates();
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const deleteTemplateMutation = useMutation({
		mutationFn: async () => {
			if (!templateId) {
				throw new Error("No template selected");
			}
			return orpcClient.admin.discord.messageStudio.deleteTemplate({
				id: templateId,
			});
		},
		onSuccess: () => {
			setTemplateId(null);
			setTemplateName("Untitled template");
			setMessageId(null);
			setPayload(emptyPayload());
			setEmbedEnabled(false);
			setColorHex("");
			setAuthorMatchesBot(null);
			toast.success("Template deleted");
			invalidateTemplates();
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const loadFromDiscordMutation = useMutation({
		mutationFn: async () => {
			const parsed =
				await orpcClient.admin.discord.messageStudio.parseLink({
					url: messageLinkInput,
				});
			const msg =
				await orpcClient.admin.discord.messageStudio.getDiscordMessage({
					channelId: parsed.channelId,
					messageId: parsed.messageId,
				});
			return { parsed, msg };
		},
		onSuccess: ({ parsed, msg }) => {
			setSelectedChannelId(parsed.channelId);
			setChannelIdOverride("");
			setMessageId(parsed.messageId);
			const studio = msg.studioPayload as MessageStudioPayload;
			setPayload(studio);
			const emb = studio.embed;
			const hasEmbed = Boolean(emb && Object.keys(emb).length > 0);
			setEmbedEnabled(hasEmbed);
			setColorHex(formatColorHex(emb?.color));
			setAuthorMatchesBot(msg.authorMatchesBot);
			if (!msg.authorMatchesBot) {
				toast.warning(
					"This message was not authored by the bot. You can still edit if Discord allows it — confirm when updating.",
				);
			} else {
				toast.success("Message loaded from Discord");
			}
		},
		onError: (e) => toast.error(getErrorMessage(e)),
	});

	const updateEmbed = useCallback((partial: Record<string, unknown>) => {
		setPayload((prev) => {
			const base = prev.embed ?? {};
			return {
				...prev,
				embed: { ...base, ...partial },
			};
		});
	}, []);

	const updateEmbedField = useCallback(
		(index: number, field: Partial<MessageStudioEmbedField>) => {
			setPayload((prev) => {
				const emb = prev.embed ?? {};
				const fields = [...(emb.fields ?? [])];
				fields[index] = { ...fields[index], ...field };
				return { ...prev, embed: { ...emb, fields } };
			});
		},
		[],
	);

	const addEmbedField = useCallback(() => {
		setPayload((prev) => {
			const emb = prev.embed ?? {};
			const fields = [
				...(emb.fields ?? []),
				{ name: "", value: "", inline: false },
			];
			if (fields.length > 25) {
				return prev;
			}
			return { ...prev, embed: { ...emb, fields } };
		});
	}, []);

	const removeEmbedField = useCallback((index: number) => {
		setPayload((prev) => {
			const emb = prev.embed ?? {};
			const fields = (emb.fields ?? []).filter((_, i) => i !== index);
			return { ...prev, embed: { ...emb, fields } };
		});
	}, []);

	const sortedChannels = useMemo(() => {
		const list = channelsQuery.data?.channels ?? [];
		return [...list].sort((a, b) => a.name.localeCompare(b.name));
	}, [channelsQuery.data?.channels]);

	function handleNewTemplate() {
		setTemplateId(null);
		setTemplateName("Untitled template");
		setMessageId(null);
		setPayload(emptyPayload());
		setEmbedEnabled(false);
		setColorHex("");
		setMessageLinkInput("");
		setAuthorMatchesBot(null);
		setMode("create");
		toast.message("Started a new draft");
	}

	function handleConfirmNonBotPatch() {
		patchMutation.mutate(true);
	}

	function handlePostOrUpdate() {
		if (!effectiveChannelId) {
			toast.error("Pick a channel or enter a channel ID");
			return;
		}
		if (messageId) {
			patchMutation.mutate(undefined);
		} else {
			postMutation.mutate();
		}
	}

	const isBusy =
		postMutation.isPending ||
		patchMutation.isPending ||
		loadFromDiscordMutation.isPending;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MessageSquarePlus className="h-5 w-5" />
						Templates
					</CardTitle>
					<CardDescription>
						Save drafts in the database; posting stores the Discord
						message ID for future edits.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
					<div className="min-w-[220px] flex-1 space-y-2">
						<Label>Load template</Label>
						<Select
							value={templateId ?? "__none__"}
							onValueChange={(v) => {
								if (v === "__none__") {
									handleNewTemplate();
									return;
								}
								loadTemplateMutation.mutate(v);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select saved template" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__none__">
									— New draft —
								</SelectItem>
								{(templatesQuery.data?.templates ?? []).map(
									(t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={handleNewTemplate}
					>
						New template
					</Button>
					<Button
						type="button"
						variant="outline"
						disabled={!templateId}
						onClick={() => {
							setDuplicateName(`${templateName} (copy)`);
							setDuplicateOpen(true);
						}}
					>
						Duplicate
					</Button>
					<Button
						type="button"
						variant="error"
						disabled={
							!templateId || deleteTemplateMutation.isPending
						}
						onClick={() => {
							if (
								!globalThis.confirm(
									"Delete this template from the database? Discord messages are not removed.",
								)
							) {
								return;
							}
							deleteTemplateMutation.mutate();
						}}
					>
						{deleteTemplateMutation.isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Trash2 className="h-4 w-4" />
						)}
						Delete template
					</Button>
				</CardContent>
			</Card>

			<Tabs
				value={mode}
				onValueChange={(v) => setMode(v as "create" | "edit")}
			>
				<TabsList>
					<TabsTrigger value="create">Create</TabsTrigger>
					<TabsTrigger value="edit">Edit existing</TabsTrigger>
				</TabsList>
				<TabsContent value="create" className="mt-4 space-y-4">
					<p className="text-muted-foreground text-sm">
						Compose a new message, then Post. After posting, switch
						to Edit or save the template to keep the message link.
					</p>
				</TabsContent>
				<TabsContent value="edit" className="mt-4 space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div className="min-w-0 flex-1 space-y-2">
							<Label htmlFor="msg-link">
								Discord message link
							</Label>
							<Input
								id="msg-link"
								placeholder="https://discord.com/channels/…"
								value={messageLinkInput}
								onChange={(e) =>
									setMessageLinkInput(e.target.value)
								}
							/>
						</div>
						<Button
							type="button"
							disabled={
								!messageLinkInput.trim() ||
								loadFromDiscordMutation.isPending
							}
							onClick={() => loadFromDiscordMutation.mutate()}
						>
							{loadFromDiscordMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							Load
						</Button>
					</div>
					{authorMatchesBot === false ? (
						<div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
							<span>
								This message was not sent by the bot. Discord
								may reject edits, or you may be editing someone
								else&apos;s message. Confirm if you still want
								to patch.
							</span>
						</div>
					) : null}
				</TabsContent>
			</Tabs>

			<Card>
				<CardHeader>
					<CardTitle>Channel</CardTitle>
					<CardDescription>
						Choose from the server list or paste a channel snowflake
						(override).
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>Server channel</Label>
						<Select
							value={selectedChannelId || "__pick__"}
							onValueChange={(v) =>
								setSelectedChannelId(v === "__pick__" ? "" : v)
							}
							disabled={channelsQuery.isLoading}
						>
							<SelectTrigger>
								<SelectValue
									placeholder={
										channelsQuery.isLoading
											? "Loading…"
											: "Select channel"
									}
								/>
							</SelectTrigger>
							<SelectContent className="max-h-72">
								<SelectItem value="__pick__">
									— Select —
								</SelectItem>
								{sortedChannels.map((c) => (
									<SelectItem key={c.id} value={c.id}>
										#{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{channelsQuery.isError ? (
							<p className="text-destructive text-xs">
								{getErrorMessage(channelsQuery.error)}
							</p>
						) : null}
					</div>
					<div className="space-y-2">
						<Label htmlFor="ch-override">Channel ID override</Label>
						<Input
							id="ch-override"
							placeholder="Optional snowflake"
							value={channelIdOverride}
							onChange={(e) =>
								setChannelIdOverride(e.target.value)
							}
						/>
						<p className="text-muted-foreground text-xs">
							Effective ID:{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-[11px]">
								{effectiveChannelId || "—"}
							</code>
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Message body</CardTitle>
					<CardDescription>
						Legacy Discord message: text content, one embed, link
						buttons, optional preset action button.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-2">
						<Label htmlFor="content">Content</Label>
						<Textarea
							id="content"
							rows={5}
							maxLength={2000}
							value={payload.content}
							onChange={(e) =>
								setPayload((p) => ({
									...p,
									content: e.target.value,
								}))
							}
							placeholder="Message text (optional if embed has body)"
						/>
						<p className="text-muted-foreground text-xs">
							{payload.content.length} / 2000
						</p>
					</div>

					<div className="space-y-3 rounded-lg border p-4">
						<div className="flex items-center justify-between gap-2">
							<Label className="text-base">Embed</Label>
							<Button
								type="button"
								variant={embedEnabled ? "secondary" : "outline"}
								size="sm"
								onClick={() => {
									setEmbedEnabled((on) => {
										if (on) {
											setPayload((p) => ({
												...p,
												embed: null,
											}));
											setColorHex("");
											return false;
										}
										const primaryHex = getCssPrimaryHex();
										const colorNum =
											parseColorInput(primaryHex);
										setColorHex(primaryHex);
										setPayload((p) => {
											const base = p.embed ?? {};
											const keepExistingColor =
												typeof base.color === "number";
											return {
												...p,
												embed: {
													...base,
													...(keepExistingColor ||
													colorNum === undefined
														? {}
														: { color: colorNum }),
												},
											};
										});
										return true;
									});
								}}
							>
								{embedEnabled
									? "Disable embed"
									: "Enable embed"}
							</Button>
						</div>
						{embedEnabled ? (
							<div className="grid gap-4 md:grid-cols-2">
								<p className="text-muted-foreground md:col-span-2 text-xs">
									Order matches how Discord shows the embed:
									author → body → fields → large image →
									footer & timestamp.
								</p>

								{/* Author (top of embed in Discord) */}
								<div className="md:col-span-2 space-y-1">
									<p className="text-muted-foreground text-xs font-medium">
										Author
									</p>
								</div>
								<div className="space-y-2">
									<Label>Author name</Label>
									<Input
										maxLength={256}
										value={
											payload.embed?.author?.name ?? ""
										}
										onChange={(e) =>
											updateEmbed({
												author: {
													name: e.target.value,
													url: payload.embed?.author
														?.url,
													iconUrl:
														payload.embed?.author
															?.iconUrl,
												},
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Author URL</Label>
									<Input
										maxLength={2048}
										value={payload.embed?.author?.url ?? ""}
										onChange={(e) =>
											updateEmbed({
												author: {
													name:
														payload.embed?.author
															?.name ?? "",
													url:
														e.target.value ||
														undefined,
													iconUrl:
														payload.embed?.author
															?.iconUrl,
												},
											})
										}
									/>
								</div>
								<div className="space-y-2 md:col-span-2">
									<Label>Author icon URL</Label>
									<Input
										maxLength={2048}
										value={
											payload.embed?.author?.iconUrl ?? ""
										}
										onChange={(e) =>
											updateEmbed({
												author: {
													name:
														payload.embed?.author
															?.name ?? "",
													url: payload.embed?.author
														?.url,
													iconUrl:
														e.target.value ||
														undefined,
												},
											})
										}
									/>
								</div>

								{/* Accent bar (Discord left stripe) */}
								<div className="space-y-2 md:col-span-2">
									<Label>
										Color (#RRGGBB or decimal) — left accent
										bar
									</Label>
									<Input
										value={colorHex}
										onChange={(e) => {
											setColorHex(e.target.value);
											const n = parseColorInput(
												e.target.value,
											);
											updateEmbed(
												n === undefined
													? { color: undefined }
													: { color: n },
											);
										}}
										placeholder={getCssPrimaryHex()}
									/>
									<p className="text-muted-foreground text-xs">
										Default when you enable the embed
										matches this app&apos;s
										<code className="mx-1 rounded bg-muted px-1">
											--primary
										</code>
										(see{" "}
										<code className="rounded bg-muted px-1">
											tooling/tailwind/theme.css
										</code>
										).
									</p>
								</div>

								{/* Title & body */}
								<div className="md:col-span-2 space-y-1 pt-1">
									<p className="text-muted-foreground text-xs font-medium">
										Title & description
									</p>
								</div>
								<div className="space-y-2">
									<Label>Title</Label>
									<Input
										maxLength={256}
										value={payload.embed?.title ?? ""}
										onChange={(e) =>
											updateEmbed({
												title: e.target.value,
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>URL</Label>
									<Input
										maxLength={2048}
										value={payload.embed?.url ?? ""}
										onChange={(e) =>
											updateEmbed({ url: e.target.value })
										}
									/>
								</div>
								<div className="space-y-2 md:col-span-2">
									<Label>Description</Label>
									<Textarea
										rows={4}
										maxLength={4096}
										value={payload.embed?.description ?? ""}
										onChange={(e) =>
											updateEmbed({
												description: e.target.value,
											})
										}
									/>
								</div>

								{/* Thumbnail: top-right in Discord, next to title/description */}
								<div className="space-y-2 md:col-span-2">
									<Label>Thumbnail URL</Label>
									<Input
										maxLength={2048}
										value={
											payload.embed?.thumbnail?.url ?? ""
										}
										onChange={(e) =>
											updateEmbed({
												thumbnail: e.target.value
													? { url: e.target.value }
													: undefined,
											})
										}
									/>
									<p className="text-muted-foreground text-xs">
										Small image on the top-right of the
										embed in Discord.
									</p>
								</div>

								{/* Fields */}
								<div className="space-y-2 md:col-span-2">
									<div className="flex items-center justify-between">
										<Label>Fields (max 25)</Label>
										<Button
											type="button"
											size="sm"
											variant="outline"
											disabled={
												(payload.embed?.fields
													?.length ?? 0) >= 25
											}
											onClick={addEmbedField}
										>
											Add field
										</Button>
									</div>
									<div className="space-y-3">
										{(payload.embed?.fields ?? []).map(
											(f, i) => (
												<div
													key={`embed-field-${i}`}
													className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]"
												>
													<Input
														placeholder="Name"
														maxLength={256}
														value={f.name}
														onChange={(e) =>
															updateEmbedField(
																i,
																{
																	name: e
																		.target
																		.value,
																},
															)
														}
													/>
													<Input
														placeholder="Value"
														maxLength={1024}
														value={f.value}
														onChange={(e) =>
															updateEmbedField(
																i,
																{
																	value: e
																		.target
																		.value,
																},
															)
														}
													/>
													<div className="flex items-center gap-2">
														<label className="flex items-center gap-1 text-xs">
															<input
																type="checkbox"
																checked={Boolean(
																	f.inline,
																)}
																onChange={(e) =>
																	updateEmbedField(
																		i,
																		{
																			inline: e
																				.target
																				.checked,
																		},
																	)
																}
															/>
															Inline
														</label>
														<Button
															type="button"
															size="icon"
															variant="ghost"
															onClick={() =>
																removeEmbedField(
																	i,
																)
															}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>
											),
										)}
									</div>
								</div>

								{/* Large image below fields in Discord */}
								<div className="space-y-2 md:col-span-2">
									<Label>Image URL</Label>
									<Input
										maxLength={2048}
										value={payload.embed?.image?.url ?? ""}
										onChange={(e) =>
											updateEmbed({
												image: e.target.value
													? { url: e.target.value }
													: undefined,
											})
										}
									/>
									<p className="text-muted-foreground text-xs">
										Wide image below the field grid in
										Discord.
									</p>
								</div>

								{/* Footer & timestamp (bottom in Discord) */}
								<div className="md:col-span-2 space-y-1 pt-1">
									<p className="text-muted-foreground text-xs font-medium">
										Footer & timestamp
									</p>
								</div>
								<div className="space-y-2">
									<Label>Footer text</Label>
									<Input
										maxLength={2048}
										value={
											payload.embed?.footer?.text ?? ""
										}
										onChange={(e) =>
											updateEmbed({
												footer: {
													text: e.target.value,
													iconUrl:
														payload.embed?.footer
															?.iconUrl,
												},
											})
										}
									/>
								</div>
								<div className="space-y-2">
									<Label>Footer icon URL</Label>
									<Input
										maxLength={2048}
										value={
											payload.embed?.footer?.iconUrl ?? ""
										}
										onChange={(e) =>
											updateEmbed({
												footer: {
													text:
														payload.embed?.footer
															?.text ?? "",
													iconUrl:
														e.target.value ||
														undefined,
												},
											})
										}
									/>
								</div>
								<div className="space-y-2 md:col-span-2">
									<Label>Timestamp (ISO)</Label>
									<Input
										value={payload.embed?.timestamp ?? ""}
										onChange={(e) =>
											updateEmbed({
												timestamp: e.target.value,
											})
										}
										placeholder="2026-01-01T12:00:00.000Z"
									/>
								</div>
							</div>
						) : null}
					</div>

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<Label className="text-base">Link buttons</Label>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() =>
									setPayload((p) => ({
										...p,
										linkButtons: [
											...p.linkButtons,
											{ label: "", url: "" },
										],
									}))
								}
							>
								Add link row
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							URLs must start with https://. Max five buttons per
							row, five rows total including the preset row.
						</p>
						{payload.linkButtons.map((row, i) => (
							<div
								key={`link-${i}`}
								className="flex flex-col gap-2 sm:flex-row sm:items-center"
							>
								<Input
									className="sm:max-w-[200px]"
									placeholder="Label"
									maxLength={80}
									value={row.label}
									onChange={(e) =>
										setPayload((p) => {
											const next = [...p.linkButtons];
											next[i] = {
												...next[i],
												label: e.target.value,
											};
											return { ...p, linkButtons: next };
										})
									}
								/>
								<Input
									className="flex-1"
									placeholder="https://…"
									maxLength={512}
									value={row.url}
									onChange={(e) =>
										setPayload((p) => {
											const next = [...p.linkButtons];
											next[i] = {
												...next[i],
												url: e.target.value,
											};
											return { ...p, linkButtons: next };
										})
									}
								/>
								<Button
									type="button"
									size="icon"
									variant="ghost"
									onClick={() =>
										setPayload((p) => ({
											...p,
											linkButtons: p.linkButtons.filter(
												(_, j) => j !== i,
											),
										}))
									}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						))}
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<Label>Action preset</Label>
							<Select
								value={payload.actionPreset}
								onValueChange={(v) =>
									setPayload((p) => ({
										...p,
										actionPreset:
											v as MessageStudioPayload["actionPreset"],
									}))
								}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">None</SelectItem>
									<SelectItem value="billing_upgrade">
										Billing upgrade (Stripe portal)
									</SelectItem>
									<SelectItem value="onboarding_complete">
										Onboarding complete (remove gate role)
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{payload.actionPreset !== "none" ? (
							<div className="space-y-2">
								<Label>Preset button label</Label>
								<Input
									maxLength={80}
									placeholder={
										payload.actionPreset ===
										"billing_upgrade"
											? "Upgrade"
											: "Continue"
									}
									value={payload.presetButtonLabel ?? ""}
									onChange={(e) =>
										setPayload((p) => ({
											...p,
											presetButtonLabel: e.target.value,
										}))
									}
								/>
							</div>
						) : null}
					</div>

					<div className="space-y-2">
						<Label htmlFor="tpl-name">Template name</Label>
						<Input
							id="tpl-name"
							value={templateName}
							onChange={(e) => setTemplateName(e.target.value)}
						/>
					</div>

					<div className="flex flex-wrap gap-2 border-t pt-4">
						<Button
							type="button"
							disabled={isBusy || saveTemplateMutation.isPending}
							onClick={() => saveTemplateMutation.mutate()}
						>
							{saveTemplateMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							Save template
						</Button>
						<Button
							type="button"
							variant="primary"
							disabled={isBusy}
							onClick={handlePostOrUpdate}
						>
							{postMutation.isPending ||
							patchMutation.isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : null}
							{messageId
								? "Update in Discord"
								: "Post to Discord"}
						</Button>
						<Button
							type="button"
							variant="outline"
							disabled={
								!messageId ||
								!effectiveChannelId ||
								deleteDiscordMutation.isPending
							}
							onClick={() => {
								if (
									!globalThis.confirm(
										"Delete this message in Discord? This cannot be undone.",
									)
								) {
									return;
								}
								deleteDiscordMutation.mutate();
							}}
						>
							Delete in Discord
						</Button>
					</div>
					{messageId ? (
						<p className="text-muted-foreground text-xs">
							Editing message ID{" "}
							<code className="rounded bg-muted px-1">
								{messageId}
							</code>
						</p>
					) : null}
				</CardContent>
			</Card>

			<Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Duplicate template</DialogTitle>
						<DialogDescription>
							Creates a copy without a Discord message ID so you
							can post a fresh message.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 py-2">
						<Label>New name</Label>
						<Input
							value={duplicateName}
							onChange={(e) => setDuplicateName(e.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDuplicateOpen(false)}
						>
							Cancel
						</Button>
						<Button
							disabled={
								!duplicateName.trim() ||
								duplicateMutation.isPending
							}
							onClick={() => duplicateMutation.mutate()}
						>
							Duplicate
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={nonBotConfirmOpen}
				onOpenChange={setNonBotConfirmOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Not authored by bot</DialogTitle>
						<DialogDescription>
							This message was not created by the Lifepreneur bot.
							Patching may fail or change another
							integration&apos;s message. Continue?
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setNonBotConfirmOpen(false);
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleConfirmNonBotPatch}
							disabled={patchMutation.isPending}
						>
							Update anyway
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
