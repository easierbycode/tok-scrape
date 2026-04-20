"use client";

import type { Announcement } from "@repo/api/modules/admin/types";
import { Card } from "@ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Eye } from "@/modules/ui/icons";

interface ViewStatsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	announcement: Announcement;
}

export function ViewStatsDialog({
	open,
	onOpenChange,
	announcement,
}: ViewStatsDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Announcement Statistics</DialogTitle>
					<DialogDescription>{announcement.title}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="grid grid-cols-1 gap-4">
						<Card className="p-4">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
									<Eye className="h-5 w-5 text-blue-500" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										Total Views
									</p>
									<p className="text-2xl font-bold">
										{announcement.views}
									</p>
								</div>
							</div>
						</Card>
					</div>

					<Card className="p-4 bg-muted/50">
						<p className="text-sm font-medium mb-2">
							Published Information
						</p>
						<p className="text-sm text-muted-foreground">
							This announcement was published on{" "}
							{new Date(
								announcement.createdAt,
							).toLocaleDateString("en-US", {
								year: "numeric",
								month: "long",
								day: "numeric",
							})}
						</p>
					</Card>

					<Card className="p-4 bg-yellow-500/10 border-yellow-500/20">
						<p className="text-sm font-medium text-yellow-600 dark:text-yellow-500 mb-2">
							Additional Metrics Coming Soon
						</p>
						<p className="text-sm text-muted-foreground">
							Detailed engagement analytics (unique viewers, read
							time, engagement rate) will be available in a future
							update. Currently tracking total views only.
						</p>
					</Card>
				</div>
			</DialogContent>
		</Dialog>
	);
}
