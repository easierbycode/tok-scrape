import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import {
	getOrganizationList,
	getPurchases,
	getSession,
} from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { organizationListQueryKey } from "@saas/organizations/lib/api";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { Document } from "@shared/components/Document";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { AnnouncementManager } from "@/components/AnnouncementManager";

export default async function SaaSLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();
	const session = await getSession();

	// Require authentication for all routes under /app, /onboarding, etc.
	if (!session) {
		redirect("/auth/login");
	}

	const queryClient = getServerQueryClient();

	// Only prefetch session data if we have a session
	if (session) {
		await queryClient.prefetchQuery({
			queryKey: sessionQueryKey,
			queryFn: () => session,
		});
	}

	if (config.organizations.enable && session) {
		await queryClient.prefetchQuery({
			queryKey: organizationListQueryKey,
			queryFn: getOrganizationList,
		});
	}

	if (config.users.enableBilling && session) {
		await queryClient.prefetchQuery({
			...orpc.payments.listPurchases.queryOptions({ input: {} }),
			queryFn: getPurchases,
		});
	}

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				<HydrationBoundary state={dehydrate(queryClient)}>
					<SessionProvider>
						<ActiveOrganizationProvider>
							<ConfirmationAlertProvider>
								<AnnouncementManager />
								{children}
							</ConfirmationAlertProvider>
						</ActiveOrganizationProvider>
					</SessionProvider>
				</HydrationBoundary>
			</NextIntlClientProvider>
		</Document>
	);
}
