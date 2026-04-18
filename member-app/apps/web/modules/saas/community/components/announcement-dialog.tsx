"use client";

import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Eye, EyeOff } from "@/modules/ui/icons";
import type { Announcement } from "../lib/types";

interface AnnouncementDialogProps {
	announcement: Announcement | null;
	isOpen: boolean;
	onClose: () => void;
	onToggleRead: (id: string) => void;
}

export function AnnouncementDialog({
	announcement,
	isOpen,
	onClose,
	onToggleRead,
}: AnnouncementDialogProps) {
	if (!announcement) {
		return null;
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-h-[88vh] sm:w-full">
				<DialogHeader className="shrink-0 space-y-4 border-b border-border/50 px-4 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
					<DialogTitle className="pr-10 text-left font-serif font-semibold tracking-tight text-xl leading-tight sm:pr-12 sm:text-2xl sm:leading-tight">
						{announcement.title}
					</DialogTitle>
					<div className="flex flex-wrap items-center gap-3">
						<Badge
							status="info"
							className="text-xs font-medium capitalize"
						>
							{announcement.type}
						</Badge>
						<span className="text-xs font-medium text-muted-foreground">
							{new Date(announcement.date).toLocaleDateString(
								"en-US",
								{
									month: "long",
									day: "numeric",
									year: "numeric",
								},
							)}
						</span>
					</div>
				</DialogHeader>

				<div
					className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-7 sm:py-7 
                     [-webkit-overflow-scrolling:touch] [scrollbar-width:none] 
                     [&::-webkit-scrollbar]:hidden [overscroll-behavior:contain]"
				>
					<div className="space-y-4 text-sm leading-relaxed text-foreground/90 sm:text-base sm:leading-relaxed">
						{announcement.fullContent
							.split("\n")
							.map((paragraph, index) => (
								<p
									key={index}
									className={
										paragraph.trim() === ""
											? "h-2"
											: "whitespace-pre-wrap"
									}
								>
									{paragraph}
								</p>
							))}
					</div>
				</div>

				<div className="shrink-0 border-t border-border/50 px-4 py-4 sm:px-7 sm:py-5">
					<Button
						variant="outline"
						onClick={() => {
							onToggleRead(announcement.id);
							onClose();
						}}
						className="min-h-[48px] sm:min-h-[44px] w-full gap-2 hover:bg-accent/50 sm:w-auto"
					>
						{announcement.read ? (
							<>
								<EyeOff className="h-4 w-4" />
								Mark as Unread
							</>
						) : (
							<>
								<Eye className="h-4 w-4" />
								Mark as Read
							</>
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
