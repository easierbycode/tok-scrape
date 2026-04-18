"use client";

import { cn } from "@ui/lib";
import { useState } from "react";

interface SubsectionChipsProps {
	subsections: string[];
	children: (activeSubsection: string | null) => React.ReactNode;
}

function formatLabel(subsection: string) {
	return subsection
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function SubsectionChips({
	subsections,
	children,
}: SubsectionChipsProps) {
	const [active, setActive] = useState<string | null>(null);

	if (subsections.length === 0) {
		return <>{children(null)}</>;
	}

	return (
		<>
			<div className="flex flex-wrap gap-2 mb-5 sm:mb-6">
				<button
					type="button"
					onClick={() => setActive(null)}
					className={cn(
						"rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
						active === null
							? "bg-primary text-primary-foreground border-primary"
							: "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
					)}
				>
					All
				</button>
				{subsections.map((sub) => (
					<button
						key={sub}
						type="button"
						onClick={() => setActive(active === sub ? null : sub)}
						className={cn(
							"rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors border",
							active === sub
								? "bg-primary text-primary-foreground border-primary"
								: "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
						)}
					>
						{formatLabel(sub)}
					</button>
				))}
			</div>
			{children(active)}
		</>
	);
}
