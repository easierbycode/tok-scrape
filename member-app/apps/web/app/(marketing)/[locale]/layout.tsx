import { getCachedMarketingContent } from "@marketing/lib/marketing-content-cache";
import { Footer } from "@marketing/shared/components/Footer";
import { NavBar } from "@marketing/shared/components/NavBar";
import { StickyCTA } from "@marketing/shared/components/StickyCTA";
import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { Document } from "@shared/components/Document";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";

const locales = Object.keys(config.i18n.locales);

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

export default async function MarketingLayout({
	children,
	params,
}: PropsWithChildren<{ params: Promise<{ locale: string }> }>) {
	const { locale } = await params;

	setRequestLocale(locale);

	if (!locales.includes(locale as any)) {
		notFound();
	}

	const messages = await getMessages();

	const marketingContent = await getCachedMarketingContent();
	const stickyCtaProps: Record<string, string> = {};
	if (marketingContent) {
		if (marketingContent.stickyCtaTitle) {
			stickyCtaProps.title = marketingContent.stickyCtaTitle;
		}
		if (marketingContent.stickyCtaSubtitle) {
			stickyCtaProps.subtitle = marketingContent.stickyCtaSubtitle;
		}
		if (marketingContent.stickyCtaButtonText) {
			stickyCtaProps.buttonText = marketingContent.stickyCtaButtonText;
		}
		if (marketingContent.stickyCtaMobileText) {
			stickyCtaProps.mobileText = marketingContent.stickyCtaMobileText;
		}
		if (marketingContent.stickyCtaLink) {
			stickyCtaProps.link = marketingContent.stickyCtaLink;
		}
	}

	return (
		<Document locale={locale}>
			<NextIntlClientProvider locale={locale} messages={messages}>
				<SessionProvider>
					<NavBar />
					<a
						href="#pricing"
						className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
					>
						Skip to pricing
					</a>
					<main className="min-h-screen">{children}</main>
					<StickyCTA {...stickyCtaProps} />
					<Footer />
				</SessionProvider>
			</NextIntlClientProvider>
		</Document>
	);
}
