import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import { cn } from "@ui/lib";
import { Fraunces, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

const sansFont = Inter({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-sans",
	display: "swap",
});

const serifFont = Fraunces({
	weight: ["400", "500", "600", "700"],
	subsets: ["latin"],
	variable: "--font-serif",
	display: "swap",
});

export async function Document({
	children,
	locale,
}: PropsWithChildren<{ locale: string }>) {
	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={cn(sansFont.variable, serifFont.variable)}
		>
			<head>
				{/* Preconnect to Rewardful for faster loading */}
				<link rel="preconnect" href="https://r.wdfl.co" />
				<link rel="dns-prefetch" href="https://r.wdfl.co" />

				{/* Rewardful init snippet — creates the rewardful() queue before rw.js loads */}
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static Rewardful queue initializer required before rw.js loads; content is hard-coded
					dangerouslySetInnerHTML={{
						__html: "(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');",
					}}
				/>
				<script
					async
					src="https://r.wdfl.co/rw.js"
					data-rewardful={process.env.NEXT_PUBLIC_REWARDFUL_ID}
				/>
			</head>
			<body
				className={cn(
					"min-h-screen bg-background font-sans text-foreground antialiased",
				)}
			>
				<div
					aria-live="polite"
					aria-atomic="true"
					className="sr-only"
					id="status-messages"
				/>
				<NuqsAdapter>
					<ConsentProvider
						initialConsent={
							consentCookie?.value === "true"
								? true
								: consentCookie?.value === "false"
									? false
									: undefined
						}
					>
						<ClientProviders>{children}</ClientProviders>
					</ConsentProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
