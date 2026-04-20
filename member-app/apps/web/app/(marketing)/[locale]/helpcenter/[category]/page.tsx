import { Breadcrumbs } from "@marketing/help-center/components/Breadcrumbs";
import { FilteredArticleList } from "@marketing/help-center/components/FilteredArticleList";
import { ErrorBoundary } from "@marketing/shared/components/ErrorBoundary";
import { orpcClient } from "@shared/lib/orpc-client";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { cache } from "react";
import * as LucideIcons from "@/modules/ui/icons";

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
	params: Promise<{ category: string; locale: string }>;
}): Promise<Metadata> {
	const { category } = await params;
	const result = await getCategoryData(category);

	if (!result?.category) {
		return {
			title: "Category Not Found - LifePreneur Help Center",
		};
	}

	return {
		title: `${result.category.title} - LifePreneur Help Center`,
		description: result.category.description,
	};
}

export default async function CategoryPage({
	params,
}: {
	params: Promise<{ category: string; locale: string }>;
}) {
	const { category, locale } = await params;
	setRequestLocale(locale);

	const result = await getCategoryData(category);

	if (!result?.category) {
		notFound();
	}

	const categoryData = result.category;

	const IconComponent =
		(LucideIcons as any)[categoryData.icon] || LucideIcons.HelpCircle;

	return (
		<ErrorBoundary>
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-4xl">
					<Breadcrumbs
						items={[
							{ label: "Help Center", href: "/helpcenter" },
							{ label: categoryData.title },
						]}
					/>

					<div className="mb-6 sm:mb-8">
						<div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
							<div className="rounded-lg bg-primary/10 p-2.5 sm:p-3 shrink-0">
								<IconComponent className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-primary" />
							</div>
							<div className="min-w-0">
								<h1 className="mb-1.5 font-serif text-2xl font-semibold leading-[1.1] tracking-tight sm:mb-2 sm:text-3xl md:text-4xl">
									{categoryData.title}
								</h1>
								<p className="text-sm sm:text-base md:text-lg text-muted-foreground">
									{categoryData.description}
								</p>
							</div>
						</div>
					</div>

					<FilteredArticleList
						articles={categoryData.articles || []}
						categorySlug={category}
					/>
				</div>
			</div>
		</ErrorBoundary>
	);
}
