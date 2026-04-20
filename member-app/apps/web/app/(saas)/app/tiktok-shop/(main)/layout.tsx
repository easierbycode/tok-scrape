import { BETA_FEATURE_IDS } from "@repo/config/beta-features";
import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/modules/saas/tiktok-dashboard/components/app-sidebar";
import { BottomNav } from "@/modules/saas/tiktok-dashboard/components/bottom-nav";

export default async function TiktokShopMainLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login?redirectTo=/app/tiktok-shop");
	}

	const betaFeatures: string[] =
		(session.user as { betaFeatures?: string[] })?.betaFeatures ?? [];
	const hasTiktokBeta = betaFeatures.includes(
		BETA_FEATURE_IDS.TIKTOK_DASHBOARD_BETA,
	);

	if (!hasTiktokBeta) {
		redirect("/app/tiktok-shop/coming-soon");
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<AppSidebar />
			<BottomNav />
			<main className="pb-20 md:ml-64 md:pb-0">
				<div className="relative">{children}</div>
			</main>
		</div>
	);
}
