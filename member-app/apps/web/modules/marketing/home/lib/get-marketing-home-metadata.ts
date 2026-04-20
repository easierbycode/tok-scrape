import { db } from "@repo/database";
import type { Metadata } from "next";

const defaultTitle = "LifePreneur — The Creator Business Community";
const defaultDescription =
	"Live training, private community, and an affiliate program for creators who are serious about building a real business. Join LifePreneur today.";

function toAbsoluteOgImageUrl(url: string): string {
	const trimmed = url.trim();
	if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
		return trimmed;
	}

	const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
	if (fromEnv && trimmed.startsWith("/")) {
		return `${fromEnv}${trimmed}`;
	}

	const vercel = process.env.VERCEL_URL?.replace(/^https?:\/\//, "");
	if (vercel && trimmed.startsWith("/")) {
		return `https://${vercel}${trimmed}`;
	}

	return trimmed;
}

export async function getMarketingHomeMetadata(): Promise<Metadata> {
	let title = defaultTitle;
	let description = defaultDescription;
	let ogImage: string | undefined;

	try {
		const content = await db.marketingContent.findUnique({
			where: { id: "singleton" },
			select: {
				seoTitle: true,
				seoDescription: true,
				seoOgImage: true,
			},
		});
		if (content?.seoTitle?.trim()) {
			title = content.seoTitle.trim();
		}
		if (content?.seoDescription?.trim()) {
			description = content.seoDescription.trim();
		}
		if (content?.seoOgImage?.trim()) {
			ogImage = toAbsoluteOgImageUrl(content.seoOgImage);
		}
	} catch {
		// Table may not exist in some environments
	}

	const metadata: Metadata = {
		title,
		description,
		openGraph: {
			title,
			description,
			...(ogImage ? { images: [{ url: ogImage }] } : {}),
		},
		twitter: {
			card: ogImage ? "summary_large_image" : "summary",
			title,
			description,
			...(ogImage ? { images: [ogImage] } : {}),
		},
	};

	return metadata;
}
