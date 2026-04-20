"use client";

import { Card } from "@ui/components/card";
import Link from "next/link";
import { ArrowRight } from "@/modules/ui/icons";

interface FeaturedArticle {
	id: string;
	slug: string;
	title: string;
	excerpt: string | null;
	category: {
		slug: string;
		title: string;
	};
}

interface PopularQuestionsProps {
	articles: FeaturedArticle[];
}

export function PopularQuestions({ articles }: PopularQuestionsProps) {
	if (articles.length === 0) {
		return null;
	}

	return (
		<div>
			<h2 className="mb-4 font-serif text-xl font-semibold leading-[1.1] tracking-tight sm:mb-5 sm:text-2xl">
				Popular questions
			</h2>
			<div className="flex gap-3 sm:gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
				{articles.map((article) => (
					<Link
						key={article.id}
						href={`/helpcenter/${article.category.slug}/${article.slug}`}
						className="snap-start shrink-0 w-[280px] sm:w-[320px]"
					>
						<Card className="group h-full p-4 shadow-flat transition-[transform,box-shadow] duration-300 hover:border-primary hover:shadow-elevated md:hover:shadow-elevated-desktop sm:p-5">
							<h3 className="font-semibold text-sm sm:text-base mb-2 group-hover:text-primary transition-colors line-clamp-2">
								{article.title}
							</h3>
							<p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-3">
								{article.excerpt ||
									"Read more about this topic"}
							</p>
							<div className="flex items-center gap-1.5 text-xs sm:text-sm text-primary font-medium">
								<span>Read article</span>
								<ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
							</div>
						</Card>
					</Link>
				))}
			</div>
		</div>
	);
}
