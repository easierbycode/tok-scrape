import { AdminContextProvider } from "@saas/admin/lib/admin-context";
import { checkIsSuperAdmin } from "@saas/admin/lib/super-admin";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { getSession } from "@saas/auth/lib/server";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { Document } from "@shared/components/Document";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";

export default async function AdminRootLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	const messages = await getMessages();
	const session = await getSession();

	const queryClient = getServerQueryClient();

	if (session) {
		await queryClient.prefetchQuery({
			queryKey: sessionQueryKey,
			queryFn: () => session,
		});
	}

	const isSuperAdmin = session?.user
		? checkIsSuperAdmin(session.user.email)
		: false;

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				<HydrationBoundary state={dehydrate(queryClient)}>
					<SessionProvider>
						<AdminContextProvider isSuperAdmin={isSuperAdmin}>
							<ConfirmationAlertProvider>
								{children}
							</ConfirmationAlertProvider>
						</AdminContextProvider>
					</SessionProvider>
				</HydrationBoundary>
			</NextIntlClientProvider>
		</Document>
	);
}
