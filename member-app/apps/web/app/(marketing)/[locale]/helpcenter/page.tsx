import { CategoryCard } from "@marketing/help-center/components/CategoryCard";
import { HelpCenterSearch } from "@marketing/help-center/components/HelpCenterSearch";
import { PathCards } from "@marketing/help-center/components/PathCards";
import { PopularQuestions } from "@marketing/help-center/components/PopularQuestions";
import { ErrorBoundary } from "@marketing/shared/components/ErrorBoundary";
import { getSession } from "@saas/auth/lib/server";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { Skeleton } from "@ui/components/skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ArrowLeft, BookOpen, Mail } from "@/modules/ui/icons";

export const metadata: Metadata = {
	title: "Help Center - LifePreneur",
	description:
		"Find answers to common questions and learn how to use LifePreneur",
};

const PATH_LABELS: Record<string, string> = {
	buyer: "Thinking about joining?",
	member: "Member guides",
};

async function CategoriesGrid({ audience }: { audience?: string }) {
	const categoriesData = await orpcClient.helpCenter.listCategories({
		audience,
	});
	const categories = categoriesData?.categories || [];

	if (categories.length === 0) {
		return (
			<div className="text-center py-12">
				<BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
				<h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
				<p className="text-muted-foreground">
					Help articles will be available shortly.
				</p>
			</div>
		);
	}

	return (
		<div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
			{categories.map((category: any) => (
				<CategoryCard
					key={category.id}
					slug={category.slug}
					title={category.title}
					description={category.description}
					icon={category.icon}
					articleCount={category.articleCount || 0}
				/>
			))}
		</div>
	);
}

function CategoriesGridSkeleton() {
	return (
		<div className="grid gap-4 sm:gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<Skeleton key={i} className="h-48 rounded-lg" />
			))}
		</div>
	);
}

async function FeaturedSection({ isSignedIn }: { isSignedIn: boolean }) {
	const audience = isSignedIn ? "member" : "buyer";
	try {
		const data = await orpcClient.helpCenter.listFeaturedArticles({
			audience,
			limit: 5,
		});
		return <PopularQuestions articles={data?.articles || []} />;
	} catch {
		return null;
	}
}

export default async function HelpCenterPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ path?: string }>;
}) {
	const { locale } = await params;
	const { path } = await searchParams;
	setRequestLocale(locale);

	const session = await getSession();
	const isSignedIn = !!session?.user;

	const isFiltered = path === "buyer" || path === "member";

	if (isFiltered) {
		return (
			<ErrorBoundary>
				<div className="min-h-screen bg-background">
					<div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-6xl">
						<div className="mb-6 sm:mb-8">
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
							>
								<Link href="/helpcenter">
									<ArrowLeft className="mr-1.5 h-4 w-4" />
									Back to Help Center
								</Link>
							</Button>

							<h1 className="mb-2 font-serif text-2xl font-semibold leading-[1.1] tracking-tight sm:text-3xl md:text-4xl">
								{PATH_LABELS[path]}
							</h1>
							<p className="text-sm sm:text-base text-muted-foreground">
								{path === "buyer"
									? "Everything you need to know before becoming a member."
									: "Guides and information for LifePreneur members."}
							</p>
						</div>

						<div className="mb-6 sm:mb-8">
							<HelpCenterSearch />
						</div>

						<Suspense fallback={<CategoriesGridSkeleton />}>
							<CategoriesGrid audience={path} />
						</Suspense>

						<Card className="mt-8 bg-muted/50 p-4 shadow-flat sm:mt-10 sm:p-6">
							<div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
								<div className="rounded-lg bg-primary/10 p-2.5 sm:p-3 shrink-0">
									<Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
								</div>
								<div className="flex-1">
									<h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">
										Still need help?
									</h3>
									<p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
										Can&apos;t find what you&apos;re looking
										for? Our support team is here to help.
									</p>
									<Button
										asChild
										size="sm"
										className="sm:h-10"
									>
										<Link href="/contact">
											Contact Support
										</Link>
									</Button>
								</div>
							</div>
						</Card>
					</div>
				</div>
			</ErrorBoundary>
		);
	}

	return (
		<ErrorBoundary>
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 sm:px-6 pt-24 sm:pt-28 md:pt-32 pb-6 sm:pb-8 md:pb-12 max-w-6xl">
					{/* Hero */}
					<div className="text-center mb-8 sm:mb-10 md:mb-12">
						<h1 className="mb-3 px-2 font-serif text-2xl font-semibold leading-[1.1] tracking-tight sm:mb-4 sm:text-3xl md:text-4xl lg:text-5xl">
							How can we help?
						</h1>
						<p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 px-2">
							Find answers about LifePreneur membership,
							community, billing, and more.
						</p>
						<HelpCenterSearch />
					</div>

					{/* Path cards */}
					<div className="mb-8 sm:mb-10 md:mb-12">
						<PathCards isSignedIn={isSignedIn} />
					</div>

					{/* Popular questions */}
					<div className="mb-8 sm:mb-10 md:mb-12">
						<Suspense fallback={null}>
							<FeaturedSection isSignedIn={isSignedIn} />
						</Suspense>
					</div>

					{/* Browse all categories */}
					<div className="mb-8 sm:mb-10 md:mb-12">
						<h2 className="mb-4 font-serif text-xl font-semibold leading-[1.1] tracking-tight sm:mb-6 sm:text-2xl">
							Browse all topics
						</h2>
						<Suspense fallback={<CategoriesGridSkeleton />}>
							<CategoriesGrid />
						</Suspense>
					</div>

					{/* Contact */}
					<Card className="bg-muted/50 p-4 shadow-flat sm:p-6">
						<div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
							<div className="shrink-0 rounded-lg bg-primary/10 p-2.5 sm:p-3">
								<Mail className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
							</div>
							<div className="flex-1">
								<h3 className="mb-1.5 font-semibold text-base sm:mb-2 sm:text-lg">
									Still need help?
								</h3>
								<p className="mb-3 text-sm text-muted-foreground sm:mb-4 sm:text-base">
									Can&apos;t find what you&apos;re looking
									for? Our support team is here to help.
								</p>
								<Button asChild size="sm" className="sm:h-10">
									<Link href="/contact">Contact Support</Link>
								</Button>
							</div>
						</div>
					</Card>
				</div>
			</div>
		</ErrorBoundary>
	);
}
