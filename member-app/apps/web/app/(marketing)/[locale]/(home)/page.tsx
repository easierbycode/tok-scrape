import { BenefitsSection } from "@marketing/home/components/v0/benefits-section";
import { FaqSection } from "@marketing/home/components/v0/faq-section";
import { FinalCTA } from "@marketing/home/components/v0/final-cta";
import { HeroSection } from "@marketing/home/components/v0/hero-section";
import { PricingPreview } from "@marketing/home/components/v0/pricing-preview";
import { TestimonialsSection } from "@marketing/home/components/v0/testimonials-section";
import { getMarketingHomeMetadata } from "@marketing/home/lib/get-marketing-home-metadata";
import { Skeleton } from "@ui/components/skeleton";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const revalidate = 300;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	await params;
	return getMarketingHomeMetadata();
}

export default async function Home({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
			<Suspense
				fallback={
					<div className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-20 px-4 md:px-8">
						<div className="mx-auto max-w-7xl flex flex-col items-center gap-6 mb-12 md:mb-16">
							<Skeleton className="h-10 w-72 max-w-full rounded-full" />
							<Skeleton className="h-14 w-full max-w-3xl rounded-lg" />
							<Skeleton className="h-24 w-full max-w-2xl rounded-lg" />
						</div>
						<div className="flex justify-center mb-12 md:mb-16">
							<Skeleton className="aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px] rounded-[2.5rem]" />
						</div>
						<div className="flex flex-col items-center gap-8">
							<Skeleton className="h-12 w-48 rounded-md" />
							<Skeleton className="h-10 w-64 rounded-md" />
						</div>
					</div>
				}
			>
				<HeroSection />
			</Suspense>
			<ErrorBoundary
				fallback={
					<div className="border-b border-border py-24 md:py-32">
						<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
								<Skeleton className="h-96 rounded-lg" />
								<Skeleton className="h-96 rounded-lg" />
							</div>
						</div>
					</div>
				}
			>
				<Suspense
					fallback={
						<div className="border-b border-border py-24 md:py-32">
							<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
									<Skeleton className="h-96 rounded-lg" />
									<Skeleton className="h-96 rounded-lg" />
								</div>
							</div>
						</div>
					}
				>
					<PricingPreview />
				</Suspense>
			</ErrorBoundary>
			<Suspense
				fallback={
					<div className="border-b border-border py-24 md:py-32">
						<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
							<div className="grid gap-8 md:grid-cols-3">
								<Skeleton className="h-64 rounded-lg" />
								<Skeleton className="h-64 rounded-lg" />
								<Skeleton className="h-64 rounded-lg" />
							</div>
						</div>
					</div>
				}
			>
				<BenefitsSection />
			</Suspense>
			<Suspense
				fallback={
					<div className="pt-24 pb-12 md:pt-32 md:pb-20">
						<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
							<div className="mb-16 flex flex-col items-center gap-4">
								<Skeleton className="h-8 w-40 rounded-full" />
								<Skeleton className="h-12 w-full max-w-xl rounded-lg" />
								<Skeleton className="h-6 w-full max-w-lg rounded-lg" />
							</div>
							<div className="flex gap-6 overflow-hidden">
								<Skeleton className="h-64 w-[350px] flex-shrink-0 rounded-lg" />
								<Skeleton className="h-64 w-[350px] flex-shrink-0 rounded-lg" />
								<Skeleton className="h-64 w-[350px] flex-shrink-0 rounded-lg" />
							</div>
						</div>
					</div>
				}
			>
				<TestimonialsSection />
			</Suspense>
			<Suspense
				fallback={
					<div className="border-b border-border py-24 md:py-32">
						<div className="mx-auto max-w-3xl px-4 md:px-8">
							<Skeleton className="h-64 rounded-lg" />
						</div>
					</div>
				}
			>
				<FaqSection />
			</Suspense>
			<Suspense
				fallback={
					<div className="border-b border-border py-24 md:py-32">
						<div className="mx-auto max-w-4xl px-4 text-center">
							<Skeleton className="h-48 rounded-lg" />
						</div>
					</div>
				}
			>
				<FinalCTA />
			</Suspense>
		</>
	);
}
