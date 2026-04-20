import { cn } from "@ui/lib";
import type { ReactNode } from "react";

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	action?: ReactNode;
	className?: string;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4 px-6 py-12 text-center",
				className,
			)}
		>
			{icon && (
				<div className="flex size-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
					{icon}
				</div>
			)}
			<div className="flex max-w-sm flex-col gap-1.5">
				<h3 className="font-serif font-semibold text-lg tracking-tight">
					{title}
				</h3>
				{description && (
					<p className="text-muted-foreground text-sm">
						{description}
					</p>
				)}
			</div>
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
