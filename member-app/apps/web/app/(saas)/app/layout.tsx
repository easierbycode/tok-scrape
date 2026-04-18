import { config } from "@repo/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { ImpersonationBanner } from "@saas/admin/component/ImpersonationBanner";
import {
	getOrganizationList,
	getPurchases,
	getSession,
} from "@saas/auth/lib/server";
import { NotificationBanner } from "@saas/shared/components/NotificationBanner";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";
import { OnboardingRedirect } from "@/components/onboarding-redirect";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Layout({ children }: PropsWithChildren) {
	const session = await getSession();

	// Require authentication
	if (!session) {
		redirect("/auth/login");
	}

	// Redirect to onboarding if not complete
	const user = session.user as typeof session.user & {
		onboardingComplete?: boolean;
	};
	if (config.users.enableOnboarding && !(user.onboardingComplete ?? false)) {
		redirect("/onboarding");
	}

	// Organization and billing checks
	if (session) {
		const organizations = await getOrganizationList();

		if (
			config.organizations.enable &&
			config.organizations.requireOrganization
		) {
			const organization = organizations[0];

			if (!organization) {
				redirect("/new-organization");
			}
		}

		const hasFreePlan = Object.values(config.payments.plans).some(
			(plan) => "isFree" in plan,
		);

		if (
			((config.organizations.enable &&
				config.organizations.enableBilling) ||
				config.users.enableBilling) &&
			!hasFreePlan
		) {
			const purchases = await getPurchases();
			const { activePlan } = createPurchasesHelper(purchases);

			if (!activePlan) {
				redirect("/choose-plan");
			}
		}
	}

	return (
		<>
			<ImpersonationBanner />
			<div className="pt-0 lg:pt-8 bg-[radial-gradient(farthest-corner_at_0%_0%,color-mix(in_oklch,var(--color-primary),transparent_95%)_0%,var(--color-background)_50%)] dark:bg-[radial-gradient(farthest-corner_at_0%_0%,color-mix(in_oklch,var(--color-primary),transparent_90%)_0%,var(--color-background)_50%)]">
				<div className="container mx-auto px-4">
					<NotificationBanner />
				</div>
				<OnboardingRedirect />
				{children}
			</div>
		</>
	);
}
