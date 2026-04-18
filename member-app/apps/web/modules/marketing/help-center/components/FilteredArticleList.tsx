"use client";

import { ArticleCard } from "./ArticleCard";
import { SubsectionChips } from "./SubsectionChips";

interface Article {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	views: number;
	subsection: string | null;
}

interface FilteredArticleListProps {
	articles: Article[];
	categorySlug: string;
}

export function FilteredArticleList({
	articles,
	categorySlug,
}: FilteredArticleListProps) {
	const subsections = [
		...new Set(
			articles
				.map((a) => a.subsection)
				.filter((s): s is string => s !== null && s !== ""),
		),
	];

	const hasSubsections = subsections.length > 0;

	if (!hasSubsections) {
		return (
			<div className="space-y-3 sm:space-y-4">
				{articles.length > 0 ? (
					articles.map((article) => (
						<ArticleCard
							key={article.id}
							slug={article.slug}
							categorySlug={categorySlug}
							title={article.title}
							excerpt={article.excerpt}
							views={article.views}
						/>
					))
				) : (
					<div className="text-center py-8 sm:py-12 text-muted-foreground">
						<p className="text-sm sm:text-base">
							No articles found in this category.
						</p>
					</div>
				)}
			</div>
		);
	}

	return (
		<SubsectionChips subsections={subsections}>
			{(activeSubsection) => {
				const filtered = activeSubsection
					? articles.filter((a) => a.subsection === activeSubsection)
					: articles;

				return (
					<div className="space-y-3 sm:space-y-4">
						{filtered.length > 0 ? (
							filtered.map((article) => (
								<ArticleCard
									key={article.id}
									slug={article.slug}
									categorySlug={categorySlug}
									title={article.title}
									excerpt={article.excerpt}
									views={article.views}
								/>
							))
						) : (
							<div className="text-center py-8 sm:py-12 text-muted-foreground">
								<p className="text-sm sm:text-base">
									No articles found in this section.
								</p>
							</div>
						)}
					</div>
				);
			}}
		</SubsectionChips>
	);
}
