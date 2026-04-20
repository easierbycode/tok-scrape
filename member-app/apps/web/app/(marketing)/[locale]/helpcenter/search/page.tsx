import { ArticleCard } from "@marketing/help-center/components/ArticleCard";
import { Breadcrumbs } from "@marketing/help-center/components/Breadcrumbs";
import { HelpCenterSearch } from "@marketing/help-center/components/HelpCenterSearch";
import { ErrorBoundary } from "@marketing/shared/components/ErrorBoundary";
import { logger } from "@repo/logs";
import { orpcClient } from "@shared/lib/orpc-client";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { AlertCircle } from "@/modules/ui/icons";

export const metadata: Metadata = {
	title: "Search Help Center - LifePreneur",
	description: "Search help center articles",
};

export default async function SearchPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ q?: string }>;
}) {
	const { locale } = await params;
	const { q } = await searchParams;
	setRequestLocale(locale);

	let articles: any[] = [];
	let searchError = false;
	if (q) {
		try {
			const searchResults = await orpcClient.helpCenter.searchArticles({
				query: q,
				limit: 50,
			});
			articles = searchResults?.articles || [];
		} catch (error) {
			logger.error("Help Center search failed", { error });
			searchError = true;
			articles = [];
		}
	}

	return (
		<ErrorBoundary>
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-4xl">
					<Breadcrumbs
						items={[
							{ label: "Help Center", href: "/helpcenter" },
							{ label: "Search Results" },
						]}
					/>

					<div className="mb-6 sm:mb-8">
						<h1 className="mb-3 font-serif text-2xl font-semibold leading-[1.1] tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
							Search Help Center
						</h1>
						<HelpCenterSearch />
					</div>

					{searchError && (
						<Alert variant="error" className="mb-6">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Search Unavailable</AlertTitle>
							<AlertDescription>
								We're having trouble searching right now. Please
								try again in a moment.
							</AlertDescription>
						</Alert>
					)}

					{q && !searchError && (
						<div className="mb-4 sm:mb-6">
							<p className="text-sm sm:text-base text-muted-foreground">
								Found {articles.length} result
								{articles.length !== 1 ? "s" : ""} for{" "}
								<span className="font-medium">"{q}"</span>
							</p>
						</div>
					)}

					{!searchError && (
						<div className="space-y-3 sm:space-y-4">
							{articles.length > 0 ? (
								articles.map((article: any) => (
									<ArticleCard
										key={article.id}
										slug={article.slug}
										categorySlug={article.category.slug}
										title={article.title}
										excerpt={article.excerpt}
										views={article.views}
									/>
								))
							) : q ? (
								<div className="text-center py-8 sm:py-12">
									<p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
										No articles found matching{" "}
										<span className="font-medium">
											"{q}"
										</span>
									</p>
									<p className="text-xs sm:text-sm text-muted-foreground">
										Try different keywords or browse
										categories instead.
									</p>
								</div>
							) : (
								<div className="text-center py-8 sm:py-12 text-muted-foreground">
									<p className="text-sm sm:text-base">
										Enter a search query above to find
										articles.
									</p>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</ErrorBoundary>
	);
}
