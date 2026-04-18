import { NextProvider as FumadocsNextProvider } from "fumadocs-core/framework/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/next";
import { getTranslations } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { docsSource } from "../../../../docs-source";

export default async function DocumentationLayout({
	children,
	params,
}: PropsWithChildren<{
	params: Promise<{ locale: string }>;
}>) {
	const t = await getTranslations();
	const { locale } = await params;

	return (
		<FumadocsNextProvider>
			<FumadocsRootProvider
				search={{
					enabled: true,
					options: {
						api: "/api/docs-search",
					},
				}}
				i18n={{ locale }}
			>
				<div className="pt-[4.5rem]">
					<DocsLayout
						tree={docsSource.pageTree[locale]}
						themeSwitch={{
							enabled: false,
						}}
						i18n
						nav={{
							title: <strong>{t("documentation.title")}</strong>,
							url: "/docs",
						}}
						sidebar={{
							defaultOpenLevel: 1,
						}}
					>
						{children}
					</DocsLayout>
				</div>
			</FumadocsRootProvider>
		</FumadocsNextProvider>
	);
}
