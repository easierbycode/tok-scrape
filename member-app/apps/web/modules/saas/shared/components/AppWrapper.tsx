import { config } from "@repo/config";
import { BottomNav } from "@saas/shared/components/BottomNav";
import { MobileHeader } from "@saas/shared/components/MobileHeader";
import { NavBar } from "@saas/shared/components/NavBar";
import { cn } from "@ui/lib";
import type { PropsWithChildren } from "react";
import { SubscriptionStatusBanner } from "@/components/subscription-status-banner";

export function AppWrapper({ children }: PropsWithChildren) {
	return (
		<div className={cn([config.ui.saas.useSidebarLayout ? "" : ""])}>
			<SubscriptionStatusBanner />
			{/* Mobile-only sticky app bar — replaces NavBar on small screens */}
			<MobileHeader />
			{/* Desktop nav — hidden on mobile */}
			<NavBar />
			<div
				className={cn("lg:pr-4 lg:py-4 flex", [
					config.ui.saas.useSidebarLayout
						? "min-h-[calc(100vh)] lg:ml-[280px]"
						: "",
				])}
			>
				<main
					className={cn(
						"border-0 lg:border lg:rounded-2xl lg:shadow-flat bg-card px-4 py-4 lg:p-8 min-h-full w-full pb-24 lg:pb-8",
						[config.ui.saas.useSidebarLayout ? "" : ""],
					)}
				>
					<div className="container px-0">{children}</div>
				</main>
			</div>
			<BottomNav />
		</div>
	);
}
