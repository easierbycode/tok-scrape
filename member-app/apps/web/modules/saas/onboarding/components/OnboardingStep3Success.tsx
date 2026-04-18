"use client";

import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import { useEffect, useState } from "react";
import { completeOnboarding } from "@/lib/onboarding-api";
import { CheckCircle2 } from "@/modules/ui/icons";

interface OnboardingStep3SuccessProps {
	onCompleted: () => void;
}

export function OnboardingStep3Success({
	onCompleted,
}: OnboardingStep3SuccessProps) {
	const [isComplete, setIsComplete] = useState(false);
	const [countdown, setCountdown] = useState(3);

	useEffect(() => {
		// Auto-complete onboarding when this step loads
		const complete = async () => {
			try {
				await completeOnboarding();
				setIsComplete(true);
			} catch (error) {
				logger.error("Failed to complete onboarding", { error });
				// Still allow proceeding even if completion fails
				setIsComplete(true);
			}
		};
		complete();
	}, []);

	useEffect(() => {
		// Auto-redirect countdown
		if (isComplete && countdown > 0) {
			const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
			return () => clearTimeout(timer);
		}
		if (isComplete && countdown === 0) {
			onCompleted();
		}
	}, [isComplete, countdown, onCompleted]);

	return (
		<div className="flex flex-col items-center text-center space-y-5 py-4">
			{/* Compact Animated Checkmark */}
			<div className="relative animate-scale-in">
				<div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
					<CheckCircle2 className="w-10 h-10 text-accent" />
				</div>
				{/* Pulse Effect */}
				<div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
			</div>

			{/* Compact Success Message */}
			<div className="space-y-2">
				<h2 className="font-serif text-2xl font-bold tracking-tight text-foreground">
					You're All Set!
				</h2>
				<p className="text-sm text-muted-foreground">
					Welcome to LifePreneur 🎉
				</p>
			</div>

			{/* PRIMARY CTA - Now above the fold */}
			<Button
				onClick={onCompleted}
				disabled={!isComplete}
				className="w-full max-w-md h-12 text-base font-semibold"
				size="lg"
			>
				{countdown > 0
					? `Redirecting in ${countdown}s...`
					: "Go to Dashboard"}
			</Button>

			{/* Compact confirmation - below CTA, optional view */}
			<div className="text-xs text-muted-foreground space-y-1 pt-2">
				<p>✓ Profile Created • ✓ Account Activated</p>
				{countdown > 0 && (
					<p className="text-muted-foreground/70">
						Click the button to continue now
					</p>
				)}
			</div>
		</div>
	);
}
