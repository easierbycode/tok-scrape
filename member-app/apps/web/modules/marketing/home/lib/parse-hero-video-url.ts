export interface ParsedHeroVideo {
	kind: "youtube" | "direct" | "none";
	embedSrc?: string;
	fileSrc?: string;
}

function tryParseYouTubeEmbed(input: string): string | null {
	try {
		const url = input.startsWith("http")
			? new URL(input)
			: new URL(`https://${input}`);
		if (!url.hostname.replace(/^www\./, "").includes("youtube.com")) {
			return null;
		}
		if (!url.pathname.startsWith("/embed/")) {
			return null;
		}
		const id = url.pathname
			.slice("/embed/".length)
			.split("/")[0]
			?.split("?")[0];
		return id ? `https://www.youtube.com/embed/${id}` : null;
	} catch {
		return null;
	}
}

function tryParseYouTube(input: string): string | null {
	const embed = tryParseYouTubeEmbed(input);
	if (embed) {
		return embed;
	}

	try {
		const url = input.startsWith("http")
			? new URL(input)
			: new URL(`https://${input}`);
		const host = url.hostname.replace(/^www\./, "");
		if (host === "youtu.be") {
			const id = url.pathname
				.replace(/^\//, "")
				.split("/")[0]
				?.split("?")[0];
			return id ? `https://www.youtube.com/embed/${id}` : null;
		}
		if (!host.includes("youtube.com")) {
			return null;
		}
		if (url.pathname.startsWith("/shorts/")) {
			const id = url.pathname.split("/shorts/")[1]?.split("/")[0];
			return id ? `https://www.youtube.com/embed/${id}` : null;
		}
		const v = url.searchParams.get("v");
		if (v) {
			return `https://www.youtube.com/embed/${v}`;
		}
		return null;
	} catch {
		return null;
	}
}

function isLikelyDirectVideoUrl(url: string): boolean {
	const path = url.split("?")[0]?.toLowerCase() ?? "";
	return /\.(mp4|webm|m4v|ogg)(\?|#|$)/i.test(path);
}

export function parseHeroVideoUrl(
	url: string | null | undefined,
): ParsedHeroVideo {
	if (!url?.trim()) {
		return { kind: "none" };
	}
	const trimmed = url.trim();

	const youtube = tryParseYouTube(trimmed);
	if (youtube) {
		return { kind: "youtube", embedSrc: youtube };
	}

	if (isLikelyDirectVideoUrl(trimmed)) {
		return { kind: "direct", fileSrc: trimmed };
	}

	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		return { kind: "direct", fileSrc: trimmed };
	}

	return { kind: "none" };
}
