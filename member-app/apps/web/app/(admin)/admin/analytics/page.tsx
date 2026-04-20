import { AnalyticsDashboard } from "./analytics-dashboard";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
	const dashboardEmbedUrl =
		process.env.POSTHOG_DASHBOARD_EMBED_URL ??
		process.env.NEXT_PUBLIC_POSTHOG_DASHBOARD_EMBED_URL ??
		null;

	return <AnalyticsDashboard dashboardEmbedUrl={dashboardEmbedUrl} />;
}
