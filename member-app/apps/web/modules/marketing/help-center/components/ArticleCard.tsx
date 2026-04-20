"use client";

import { Card } from "@ui/components/card";
import Link from "next/link";
import { ArrowRight, Eye } from "@/modules/ui/icons";

interface ArticleCardProps {
	slug: string;
	categorySlug: string;
	title: string;
	excerpt: string | null;
	views: number;
}

export function ArticleCard({
	slug,
	categorySlug,
	title,
	excerpt,
	views,
}: ArticleCardProps) {
	return (
		<Link
			href={`/helpcenter/${categorySlug}/${slug}`}
			className="block py-[2.5px]"
		>
			<Card className="group h-[100px] p-3 shadow-flat transition-[transform,box-shadow] duration-300 active:scale-[0.98] hover:border-primary hover:shadow-elevated sm:h-[110px] sm:p-4 md:hover:shadow-elevated-desktop">
				<div className="flex items-start justify-between gap-3 sm:gap-4 h-full">
					<div className="flex-1 min-w-0 flex flex-col">
						<h3 className="font-semibold text-sm sm:text-base mb-1.5 sm:mb-2 group-hover:text-primary transition-colors line-clamp-2">
							{title}
						</h3>
						<p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
							{excerpt || "Click to read this article"}
						</p>
					</div>
					<div className="flex items-center gap-2 sm:gap-3 shrink-0 self-start pt-1">
						{views > 0 && (
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Eye className="h-3 w-3" />
								<span className="hidden sm:inline">
									{views}
								</span>
							</div>
						)}
						<ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
					</div>
				</div>
			</Card>
		</Link>
	);
}
