import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { db } from "@repo/database";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { hasBetaFeature } from "@/lib/beta-feature-server";
import { StreamingLibrary } from "@/modules/saas/content/components/streaming-library";

export default async function ContentPage() {
	const hasAccess = await hasBetaFeature(
		BETA_FEATURE_IDS.ENHANCED_VIDEO_PLAYER,
	);

	if (!hasAccess) {
		redirect("/app/community");
	}

	// Fetch the initial (unfiltered) video list server-side so the page
	// renders with content already populated — search/filter stays client.
	const rawVideos = await db.contentVideo.findMany({
		where: { published: true },
		orderBy: { orderIndex: "asc" },
	});

	return (
		<>
			<PageHeader
				title="Content Library"
				subtitle="Premium TikTok Shop training content"
			/>
			<div className="py-6">
				<StreamingLibrary initialVideos={rawVideos} />
			</div>
		</>
	);
}
