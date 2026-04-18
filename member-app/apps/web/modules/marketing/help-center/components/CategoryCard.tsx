"use client";

import { Card } from "@ui/components/card";
import Link from "next/link";
import * as LucideIcons from "@/modules/ui/icons";
import { ArrowRight } from "@/modules/ui/icons";

interface CategoryCardProps {
	slug: string;
	title: string;
	description: string;
	icon: string;
	articleCount: number;
}

export function CategoryCard({
	slug,
	title,
	description,
	icon,
	articleCount,
}: CategoryCardProps) {
	// Dynamically get icon component
	const IconComponent = (LucideIcons as any)[icon] || LucideIcons.HelpCircle;

	return (
		<Link href={`/helpcenter/${slug}`}>
			<Card className="group h-full p-4 shadow-flat transition-[transform,box-shadow] duration-300 active:scale-[0.98] hover:border-primary hover:shadow-elevated md:hover:shadow-elevated-desktop sm:p-5 md:p-6">
				<div className="flex items-start gap-3 sm:gap-4">
					<div className="rounded-lg bg-primary/10 p-2.5 sm:p-3 group-hover:bg-primary/20 transition-colors shrink-0">
						<IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<h3 className="font-semibold text-base sm:text-lg mb-1 group-hover:text-primary transition-colors">
							{title}
						</h3>
						<p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
							{description}
						</p>
						<div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
							<span>
								{articleCount}{" "}
								{articleCount === 1 ? "article" : "articles"}
							</span>
							<ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:translate-x-1 transition-transform" />
						</div>
					</div>
				</div>
			</Card>
		</Link>
	);
}
