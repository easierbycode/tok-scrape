import { ArticleCard } from "@marketing/help-center/components/ArticleCard";
import { ArticleContent } from "@marketing/help-center/components/ArticleContent";
import { Breadcrumbs } from "@marketing/help-center/components/Breadcrumbs";
import { FeedbackButtons } from "@marketing/help-center/components/FeedbackButtons";
import { HelpArticleViewTracker } from "@marketing/help-center/components/HelpArticleViewTracker";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { cache } from "react";
import { Mail } from "@/modules/ui/icons";

const getArticleData = cache(async (categorySlug: string, slug: string) => {
	try {
		return await orpcClient.helpCenter.getArticle({ categorySlug, slug });
	} catch {
		return null;
	}
});

const getCategoryData = cache(async (slug: string) => {
	try {
		return await orpcClient.helpCenter.getCategory({ slug });
	} catch {
		return null;
	}
});

export async function generateMetadata({
	params,
}: {
	params: Promise<{ category: string; slug: string; locale: string }>;
}): Promise<Metadata> {
	const { category, slug } = await params;
	const result = await getArticleData(category, slug);

	if (!result?.article) {
		return {
			title: "Article Not Found - LifePreneur Help Center",
		};
	}

	return {
		title: `${result.article.title} - LifePreneur Help Center`,
		description: result.article.excerpt || result.article.title,
	};
}

export default async function ArticlePage({
	params,
}: {
	params: Promise<{ category: string; slug: string; locale: string }>;
}) {
	const { category, slug, locale } = await params;
	setRequestLocale(locale);

	const [articleResult, categoryResult] = await Promise.all([
		getArticleData(category, slug),
		getCategoryData(category),
	]);

	if (!articleResult?.article) {
		notFound();
	}

	const articleData = articleResult.article;
	const relatedArticles =
		categoryResult?.category?.articles
			?.filter((a: any) => a.id !== articleData.id)
			.slice(0, 3) || [];

	const lastUpdated = new Date(articleData.updatedAt).toLocaleDateString(
		locale,
		{
			year: "numeric",
			month: "long",
			day: "numeric",
		},
	);

	return (
		<div className="min-h-screen bg-background">
			<HelpArticleViewTracker
				articleId={articleData.id}
				categorySlug={category}
				articleSlug={slug}
			/>
			<div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-4xl">
				<Breadcrumbs
					items={[
						{ label: "Help Center", href: "/helpcenter" },
						{
							label: articleData.category.title,
							href: `/helpcenter/${category}`,
						},
						{ label: articleData.title },
					]}
				/>

				<article className="mb-6 sm:mb-8">
					<div className="mb-4 sm:mb-6">
						<h1 className="mb-1.5 font-serif text-2xl font-semibold leading-[1.1] tracking-tight sm:mb-2 sm:text-3xl md:text-4xl">
							{articleData.title}
						</h1>
						<p className="text-xs sm:text-sm text-muted-foreground">
							Updated {lastUpdated}
						</p>
					</div>

					<Card className="mb-4 p-4 shadow-flat sm:mb-6 sm:p-6 md:p-8">
						<ArticleContent content={articleData.content} />
					</Card>

					<div className="mb-6 sm:mb-8 py-4 border-t">
						<p className="text-sm font-medium mb-3">
							Was this helpful?
						</p>
						<FeedbackButtons articleId={articleData.id} />
					</div>
				</article>

				{relatedArticles.length > 0 && (
					<div className="mb-6 sm:mb-8">
						<h2 className="mb-3 font-serif text-xl font-semibold leading-[1.1] tracking-tight sm:mb-4 sm:text-2xl">
							Related Articles
						</h2>
						<div className="space-y-3 sm:space-y-4">
							{relatedArticles.map((article: any) => (
								<ArticleCard
									key={article.id}
									slug={article.slug}
									categorySlug={category}
									title={article.title}
									excerpt={article.excerpt}
									views={article.views}
								/>
							))}
						</div>
					</div>
				)}

				<Card className="bg-muted/50 p-4 shadow-flat sm:p-6">
					<div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
						<div className="rounded-lg bg-primary/10 p-2.5 sm:p-3 shrink-0">
							<Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
						</div>
						<div className="flex-1">
							<h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">
								Still need help?
							</h3>
							<p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
								Can't find what you're looking for? Our support
								team is here to help.
							</p>
							<Button asChild size="sm" className="sm:h-10">
								<Link href="/contact">Contact Support</Link>
							</Button>
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}
