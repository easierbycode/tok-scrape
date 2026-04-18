"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { useState } from "react";
import { toast } from "sonner";
import {
	capturePostHogProductEvent,
	POSTHOG_PRODUCT_EVENTS,
} from "@/lib/posthog-product-events";
import { ThumbsDown, ThumbsUp } from "@/modules/ui/icons";

interface FeedbackButtonsProps {
	articleId: string;
}

export function FeedbackButtons({ articleId }: FeedbackButtonsProps) {
	const [submitted, setSubmitted] = useState(false);

	const feedbackMutation = useMutation({
		mutationFn: async (helpful: boolean) => {
			const result = await orpcClient.helpCenter.recordFeedback({
				articleId,
				helpful,
			});
			return result;
		},
		onSuccess: (_, helpful) => {
			capturePostHogProductEvent(
				POSTHOG_PRODUCT_EVENTS.HELP_ARTICLE_VOTED,
				{
					article_id: articleId,
					helpful,
				},
			);
			setSubmitted(true);
			toast.success(
				helpful
					? "Thanks for your feedback!"
					: "Thanks for letting us know. We'll improve this article.",
			);
		},
		onError: () => {
			toast.error("Failed to submit feedback");
		},
	});

	if (submitted) {
		return (
			<p className="text-sm text-muted-foreground">
				Thank you for your feedback!
			</p>
		);
	}

	return (
		<div className="flex items-center gap-2 sm:gap-3">
			<Button
				variant="outline"
				size="sm"
				onClick={() => feedbackMutation.mutate(true)}
				disabled={feedbackMutation.isPending}
				className="flex items-center gap-1.5"
			>
				<ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				<span className="text-xs sm:text-sm">Yes</span>
			</Button>
			<Button
				variant="outline"
				size="sm"
				onClick={() => feedbackMutation.mutate(false)}
				disabled={feedbackMutation.isPending}
				className="flex items-center gap-1.5"
			>
				<ThumbsDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				<span className="text-xs sm:text-sm">No</span>
			</Button>
		</div>
	);
}
