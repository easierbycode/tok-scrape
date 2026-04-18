"use client";

import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { Progress } from "@ui/components/progress";
import { useEffect, useState } from "react";
import { CheckCheck, CheckCircle, Sparkles, X } from "@/modules/ui/icons";
import type { OnboardingStep } from "../lib/types";

const INITIAL_STEPS: OnboardingStep[] = [
	{ id: 1, title: "Account created", completed: true },
	{ id: 2, title: "Copy your referral link", completed: false },
	{ id: 3, title: "Share on social media", completed: false },
	{ id: 4, title: "Track your first click", completed: false },
	{ id: 5, title: "Get your first conversion", completed: false },
];

const STORAGE_KEY = "affiliate-onboarding-dismissed";

export function OnboardingBanner() {
	const [show, setShow] = useState(true);
	const [steps, setSteps] = useState(INITIAL_STEPS);

	useEffect(() => {
		// Check if banner was dismissed
		if (typeof window !== "undefined") {
			const dismissed = localStorage.getItem(STORAGE_KEY) === "true";
			setShow(!dismissed);
		}
	}, []);

	if (!show) {
		return null;
	}

	const completedCount = steps.filter((s) => s.completed).length;
	const progress = (completedCount / steps.length) * 100;

	const toggleStep = (id: number) => {
		setSteps((prev) =>
			prev.map((step) =>
				step.id === id ? { ...step, completed: !step.completed } : step,
			),
		);
	};

	const handleDismiss = () => {
		setShow(false);
		if (typeof window !== "undefined") {
			localStorage.setItem(STORAGE_KEY, "true");
		}
	};

	return (
		<Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20 relative overflow-hidden">
			<Button
				variant="ghost"
				size="icon"
				className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10"
				onClick={handleDismiss}
				aria-label="Close onboarding checklist"
			>
				<X className="w-4 h-4" aria-hidden="true" />
			</Button>

			<CardHeader className="pr-12 sm:pr-14">
				<div className="flex items-start gap-3">
					<div
						className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
						aria-hidden="true"
					>
						<Sparkles className="w-5 h-5 text-primary-foreground" />
					</div>
					<div className="flex-1">
						<CardTitle className="font-serif font-bold tracking-tight text-lg sm:text-xl mb-1">
							Get Started with Your Affiliate Journey
						</CardTitle>
						<CardDescription className="text-sm">
							Complete these steps to maximize your earnings
						</CardDescription>
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm mb-2">
						<span className="text-muted-foreground">
							{completedCount} of {steps.length} completed
						</span>
						<span className="font-semibold">
							{Math.round(progress)}%
						</span>
					</div>
					<Progress
						value={progress}
						className="h-2"
						aria-label={`${Math.round(progress)}% complete`}
					/>
				</div>

				<ul
					className="grid sm:grid-cols-2 gap-3"
					aria-label="Onboarding steps"
				>
					{steps.map((step) => (
						<li key={step.id} className="list-none">
							<button
								type="button"
								onClick={() => toggleStep(step.id)}
								className={`flex w-full items-center gap-3 p-3 rounded-lg border transition-[background-color,border-color,color] text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
									step.completed
										? "bg-success/10 border-success/30"
										: "bg-muted/50 border-border hover:bg-muted hover:border-primary/50"
								} cursor-pointer`}
								aria-label={`${step.title}${step.completed ? ", completed" : ", not completed"}`}
							>
								<div
									className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
										step.completed
											? "bg-success"
											: "bg-muted-foreground/20"
									}`}
									aria-hidden="true"
								>
									{step.completed ? (
										<CheckCircle className="w-4 h-4 text-success-foreground" />
									) : (
										<div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
									)}
								</div>
								<span
									className={
										step.completed
											? "line-through text-muted-foreground"
											: "font-medium"
									}
								>
									{step.title}
								</span>
							</button>
						</li>
					))}
				</ul>

				{progress === 100 && (
					<output className="flex items-center gap-2 p-4 bg-success/10 border border-success/30 rounded-lg mt-4">
						<CheckCheck
							className="w-5 h-5 text-success flex-shrink-0"
							aria-hidden="true"
						/>
						<p className="text-sm font-medium">
							Congratulations! You've completed all onboarding
							steps. Keep sharing and earning!
						</p>
					</output>
				)}
			</CardContent>
		</Card>
	);
}
