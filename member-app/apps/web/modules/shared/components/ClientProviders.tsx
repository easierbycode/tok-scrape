"use client";

import { AnalyticsScript } from "@analytics";
import { ProgressProvider } from "@bprogress/next/app";
import { config } from "@repo/config";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ConsentBanner } from "@shared/components/ConsentBanner";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import { Toaster } from "@ui/components/toast";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";
import { PostHogProvider } from "@/lib/posthog-provider";

export function ClientProviders({ children }: PropsWithChildren) {
	const { userHasConsented } = useCookieConsent();

	return (
		<ApiClientProvider>
			<ProgressProvider
				height="4px"
				color="var(--color-primary)"
				options={{ showSpinner: false }}
				shallowRouting
				delay={250}
			>
				<ThemeProvider
					attribute="class"
					disableTransitionOnChange
					enableSystem
					defaultTheme={config.ui.defaultTheme}
					themes={config.ui.enabledThemes}
				>
					<ApiClientProvider>
						{userHasConsented === true ? (
							<PostHogProvider>{children}</PostHogProvider>
						) : (
							children
						)}

						{/* Optional: Analytics only loads with explicit consent */}
						{userHasConsented === true && <AnalyticsScript />}

						<Toaster position="top-right" />
						<ConsentBanner />
					</ApiClientProvider>
				</ThemeProvider>
			</ProgressProvider>
		</ApiClientProvider>
	);
}
