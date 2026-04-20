"use client";

import { Badge } from "@ui/components/badge";
import { Card, CardContent } from "@ui/components/card";
import { useCardTilt } from "@ui/hooks/use-card-tilt";
import { useInView } from "@ui/hooks/use-in-view";
import { cn } from "@ui/lib";
import { formatRelativeDate } from "@/lib/date-utils";
import { AlertCircle, AlertTriangle, Circle, Info } from "@/modules/ui/icons";
import type { Announcement } from "../lib/types";

interface AnnouncementCardProps {
	announcement: Announcement;
	onMarkAsRead: (id: string) => void;
	onClick: () => void;
}

function getPriorityIcon(priority: Announcement["priority"]) {
	switch (priority) {
		case "urgent":
			return (
				<AlertCircle className="h-5 w-5 text-red-500 sm:h-6 sm:w-6" />
			);
		case "important":
			return (
				<AlertTriangle className="h-5 w-5 text-amber-500 sm:h-6 sm:w-6" />
			);
		default:
			return <Info className="h-5 w-5 text-blue-500 sm:h-6 sm:w-6" />;
	}
}

export function AnnouncementCard({
	announcement,
	onMarkAsRead: _onMarkAsRead,
	onClick,
}: AnnouncementCardProps) {
	const { ref: inViewRef, isInView } = useInView();
	const { ref: tiltRef, style: tiltStyle } = useCardTilt(6);

	return (
		<div
			ref={inViewRef}
			className={cn(
				"transition-[opacity,transform] duration-500",
				isInView
					? "opacity-100 translate-y-0"
					: "opacity-0 translate-y-4",
			)}
		>
			<Card
				ref={tiltRef}
				style={tiltStyle}
				className={`group cursor-pointer overflow-hidden transition-[box-shadow,border-color,opacity] duration-200 active:scale-[0.98] hover:shadow-raised ${
					announcement.read
						? "border border-border/50 opacity-60 hover:opacity-80"
						: "border-2 border-border/80 hover:border-border"
				}`}
				onClick={onClick}
			>
				<CardContent className="p-4 sm:p-5">
					<div className="flex gap-3 sm:gap-4">
						{/* Priority Icon */}
						<div className="shrink-0 pt-1">
							{getPriorityIcon(announcement.priority)}
						</div>

						{/* Content */}
						<div className="min-w-0 flex-1">
							{/* Title and Badges Row */}
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<h3 className="font-serif font-bold tracking-tight text-balance text-base leading-tight sm:text-lg">
									{announcement.title}
								</h3>
								{(announcement.priority === "urgent" ||
									announcement.priority === "important") && (
									<Badge
										status={
											announcement.priority === "urgent"
												? "error"
												: "warning"
										}
										className="text-xs"
									>
										{announcement.priority}
									</Badge>
								)}
								{!announcement.read && (
									<Badge
										status="info"
										className="border border-primary/30"
									>
										<Circle className="mr-1 h-2 w-2 fill-current" />
										New
									</Badge>
								)}
							</div>

							{/* Date and Author */}
							<div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
								<span>
									{formatRelativeDate(announcement.date)}
								</span>
								<span>•</span>
								<span>by {announcement.author}</span>
							</div>

							{/* Content Preview */}
							<p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
								{announcement.content}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
