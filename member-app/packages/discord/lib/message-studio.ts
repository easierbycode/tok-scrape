/**
 * Message Studio: payload shape and Discord API body builder (legacy messages).
 */

export type MessageStudioActionPreset =
	| "none"
	| "billing_upgrade"
	| "onboarding_complete";

export interface MessageStudioEmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

export interface MessageStudioEmbedInput {
	title?: string;
	description?: string;
	url?: string;
	color?: number;
	timestamp?: string;
	footer?: { text: string; iconUrl?: string };
	image?: { url: string };
	thumbnail?: { url: string };
	author?: { name: string; url?: string; iconUrl?: string };
	fields?: MessageStudioEmbedField[];
}

export interface MessageStudioPayload {
	content: string;
	embed?: MessageStudioEmbedInput | null;
	linkButtons: { label: string; url: string }[];
	actionPreset: MessageStudioActionPreset;
	presetButtonLabel?: string;
}

export const BILLING_UPGRADE_CUSTOM_ID = "billing_upgrade";
export const ONBOARDING_COMPLETE_CUSTOM_ID = "onboarding_complete";

const MAX_CONTENT = 2000;
const MAX_BUTTON_LABEL = 80;
const MAX_LINK_BUTTONS = 20;
const BUTTONS_PER_ROW = 5;

function sanitizeContent(content: string): string {
	if (content.length <= MAX_CONTENT) {
		return content;
	}
	return content.slice(0, MAX_CONTENT);
}

function buildEmbedApiObject(
	embed: MessageStudioEmbedInput,
): Record<string, unknown> {
	const o: Record<string, unknown> = {};
	if (embed.title?.trim()) {
		o.title = embed.title.trim().slice(0, 256);
	}
	if (embed.description?.trim()) {
		o.description = embed.description.trim().slice(0, 4096);
	}
	if (embed.url?.trim()) {
		o.url = embed.url.trim();
	}
	if (typeof embed.color === "number" && embed.color >= 0) {
		o.color = embed.color;
	}
	if (embed.timestamp?.trim()) {
		o.timestamp = embed.timestamp.trim();
	}
	if (embed.footer?.text?.trim()) {
		o.footer = {
			text: embed.footer.text.trim().slice(0, 2048),
			...(embed.footer.iconUrl?.trim()
				? { icon_url: embed.footer.iconUrl.trim() }
				: {}),
		};
	}
	if (embed.image?.url?.trim()) {
		o.image = { url: embed.image.url.trim() };
	}
	if (embed.thumbnail?.url?.trim()) {
		o.thumbnail = { url: embed.thumbnail.url.trim() };
	}
	if (embed.author?.name?.trim()) {
		o.author = {
			name: embed.author.name.trim().slice(0, 256),
			...(embed.author.url?.trim() ? { url: embed.author.url.trim() } : {}),
			...(embed.author.iconUrl?.trim()
				? { icon_url: embed.author.iconUrl.trim() }
				: {}),
		};
	}
	if (embed.fields?.length) {
		o.fields = embed.fields.slice(0, 25).map((f) => ({
			name: f.name.slice(0, 256),
			value: f.value.slice(0, 1024),
			inline: Boolean(f.inline),
		}));
	}
	return o;
}

export function buildDiscordMessageBody(payload: MessageStudioPayload): {
	content: string;
	embeds?: Record<string, unknown>[];
	components?: Record<string, unknown>[];
} {
	const content = sanitizeContent(payload.content ?? "");
	const embeds: Record<string, unknown>[] = [];
	if (payload.embed && Object.keys(buildEmbedApiObject(payload.embed)).length > 0) {
		embeds.push(buildEmbedApiObject(payload.embed));
	}

	if (!content && embeds.length === 0) {
		throw new Error("Message must have content and/or an embed with at least one field set");
	}

	const linkButtons = (payload.linkButtons ?? []).slice(0, MAX_LINK_BUTTONS);
	for (const b of linkButtons) {
		if (!b.label?.trim() || !b.url?.trim()) {
			throw new Error("Each link button needs a label and URL");
		}
		if (!/^https:\/\//i.test(b.url.trim())) {
			throw new Error("Link button URLs must start with https://");
		}
		if (b.label.length > MAX_BUTTON_LABEL) {
			throw new Error(`Button label must be at most ${MAX_BUTTON_LABEL} characters`);
		}
	}

	const components: Record<string, unknown>[] = [];
	for (let i = 0; i < linkButtons.length; i += BUTTONS_PER_ROW) {
		const slice = linkButtons.slice(i, i + BUTTONS_PER_ROW);
		components.push({
			type: 1,
			components: slice.map((b) => ({
				type: 2,
				style: 5,
				label: b.label.trim().slice(0, MAX_BUTTON_LABEL),
				url: b.url.trim(),
			})),
		});
	}

	if (payload.actionPreset !== "none") {
		const customId =
			payload.actionPreset === "billing_upgrade"
				? BILLING_UPGRADE_CUSTOM_ID
				: ONBOARDING_COMPLETE_CUSTOM_ID;
		let label =
			payload.presetButtonLabel?.trim() ||
			(payload.actionPreset === "billing_upgrade" ? "Upgrade" : "Continue");
		label = label.slice(0, MAX_BUTTON_LABEL);
		components.push({
			type: 1,
			components: [
				{
					type: 2,
					style: 1,
					label,
					custom_id: customId,
				},
			],
		});
	}

	if (components.length > 5) {
		throw new Error("Too many component rows (max 5). Reduce link buttons.");
	}

	const body: {
		content: string;
		embeds?: Record<string, unknown>[];
		components?: Record<string, unknown>[];
	} = { content };
	if (embeds.length > 0) {
		body.embeds = embeds;
	}
	if (components.length > 0) {
		body.components = components;
	}
	return body;
}

export function parseDiscordMessageUrl(
	input: string,
): { guildId: string; channelId: string; messageId: string } | null {
	const trimmed = input.trim();
	const match = trimmed.match(
		/discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i,
	);
	if (!match) {
		return null;
	}
	return {
		guildId: match[1],
		channelId: match[2],
		messageId: match[3],
	};
}

/** Best-effort map from a Discord API message object into studio payload for the editor. */
export function messageToStudioPayload(
	raw: Record<string, unknown>,
): MessageStudioPayload {
	const content = typeof raw.content === "string" ? raw.content : "";
	const embeds = Array.isArray(raw.embeds) ? raw.embeds : [];
	const firstEmbed = embeds[0] as Record<string, unknown> | undefined;

	let embed: MessageStudioEmbedInput | null = null;
	if (firstEmbed && typeof firstEmbed === "object") {
		const footer = firstEmbed.footer as Record<string, unknown> | undefined;
		const image = firstEmbed.image as Record<string, unknown> | undefined;
		const thumbnail = firstEmbed.thumbnail as
			| Record<string, unknown>
			| undefined;
		const author = firstEmbed.author as Record<string, unknown> | undefined;
		const fieldsRaw = firstEmbed.fields;
		const fields = Array.isArray(fieldsRaw)
			? (fieldsRaw as Record<string, unknown>[]).map((f) => ({
					name: String(f.name ?? ""),
					value: String(f.value ?? ""),
					inline: Boolean(f.inline),
				}))
			: undefined;

		embed = {
			...(typeof firstEmbed.title === "string"
				? { title: firstEmbed.title }
				: {}),
			...(typeof firstEmbed.description === "string"
				? { description: firstEmbed.description }
				: {}),
			...(typeof firstEmbed.url === "string" ? { url: firstEmbed.url } : {}),
			...(typeof firstEmbed.color === "number"
				? { color: firstEmbed.color }
				: {}),
			...(typeof firstEmbed.timestamp === "string"
				? { timestamp: firstEmbed.timestamp }
				: {}),
			...(footer && typeof footer.text === "string"
				? {
						footer: {
							text: footer.text,
							...(typeof footer.icon_url === "string"
								? { iconUrl: footer.icon_url }
								: {}),
						},
					}
				: {}),
			...(image && typeof image.url === "string"
				? { image: { url: image.url } }
				: {}),
			...(thumbnail && typeof thumbnail.url === "string"
				? { thumbnail: { url: thumbnail.url } }
				: {}),
			...(author && typeof author.name === "string"
				? {
						author: {
							name: author.name,
							...(typeof author.url === "string"
								? { url: author.url }
								: {}),
							...(typeof author.icon_url === "string"
								? { iconUrl: author.icon_url }
								: {}),
						},
					}
				: {}),
			...(fields?.length ? { fields } : {}),
		};
	}

	const linkButtons: { label: string; url: string }[] = [];
	let actionPreset: MessageStudioActionPreset = "none";
	let presetButtonLabel: string | undefined;

	const components = Array.isArray(raw.components) ? raw.components : [];
	for (const row of components as Record<string, unknown>[]) {
		const rowComponents = row.components;
		if (!Array.isArray(rowComponents)) {
			continue;
		}
		for (const btn of rowComponents as Record<string, unknown>[]) {
			if (btn.type !== 2) {
				continue;
			}
			const style = btn.style;
			const label = typeof btn.label === "string" ? btn.label : "";
			if (style === 5 && typeof btn.url === "string") {
				linkButtons.push({ label, url: btn.url });
			} else if (style === 1 && typeof btn.custom_id === "string") {
				if (btn.custom_id === BILLING_UPGRADE_CUSTOM_ID) {
					actionPreset = "billing_upgrade";
					presetButtonLabel = label;
				} else if (btn.custom_id === ONBOARDING_COMPLETE_CUSTOM_ID) {
					actionPreset = "onboarding_complete";
					presetButtonLabel = label;
				}
			}
		}
	}

	return {
		content,
		embed: embed && Object.keys(embed).length > 0 ? embed : null,
		linkButtons,
		actionPreset,
		presetButtonLabel,
	};
}
