"use client";

import Link from "next/link";
import { ChevronRight, Home } from "@/modules/ui/icons";

interface BreadcrumbItem {
	label: string;
	href?: string;
}

interface BreadcrumbsProps {
	items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
	return (
		<nav className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 overflow-x-auto">
			<Link
				href="/helpcenter"
				className="hover:text-foreground transition-colors shrink-0"
			>
				<Home className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
			</Link>
			{items.map((item, index) => (
				<div
					key={index}
					className="flex items-center gap-1.5 sm:gap-2 min-w-0"
				>
					<ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
					{item.href ? (
						<Link
							href={item.href}
							className="hover:text-foreground transition-colors truncate max-w-[150px] sm:max-w-none"
							title={item.label}
						>
							{item.label}
						</Link>
					) : (
						<span
							className="text-foreground truncate max-w-[150px] sm:max-w-none"
							title={item.label}
						>
							{item.label}
						</span>
					)}
				</div>
			))}
		</nav>
	);
}
