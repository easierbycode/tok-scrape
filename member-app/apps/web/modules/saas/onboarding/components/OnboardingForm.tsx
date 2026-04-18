"use client";
import { logger } from "@repo/logs";
import { useRouter } from "@shared/hooks/router";
import { clearCache } from "@shared/lib/cache";
import { Progress } from "@ui/components/progress";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { withQuery } from "ufo";
import { getUser, grantDiscordAccess } from "@/lib/onboarding-api";
import { OnboardingStep1 } from "./OnboardingStep1";
import { OnboardingStep2Discord } from "./OnboardingStep2Discord";
import { OnboardingStep3Success } from "./OnboardingStep3Success";

export function OnboardingForm() {
	const t = useTranslations();
	const router = useRouter();
	const searchParams = useSearchParams();

	const stepSearchParam = searchParams.get("step");
	const redirectTo = searchParams.get("redirectTo");

	const onboardingStep = stepSearchParam
		? Number.parseInt(stepSearchParam, 10)
		: 1;

	// Check if user just returned from Discord OAuth and sync Discord data
	useEffect(() => {
		async function syncDiscordData() {
			// Only run on step 2
			if (onboardingStep !== 2) {
				return;
			}

			const discordCode = searchParams.get("code");
			const discordState = searchParams.get("state");

			// If we have Discord OAuth params in URL, Better-Auth is processing
			// Don't try to sync yet - wait for the redirect
			if (discordCode && discordState) {
				if (process.env.NODE_ENV === "development") {
					logger.debug(
						"Discord OAuth in progress, waiting for Better-Auth redirect",
					);
				}
				return;
			}

			// Check user's Discord status
			try {
				const user = await getUser();

				if (!user) {
					if (process.env.NODE_ENV === "development") {
						logger.debug("No user session yet");
					}
					return;
				}

				if (user.discordConnected) {
					if (process.env.NODE_ENV === "development") {
						logger.debug(
							"User already has Discord connected, advancing to step 3",
						);
					}
					setStep(3);
					return;
				}

				// User is on step 2, not connected yet
				// Try to sync - this will succeed if Account entry exists from OAuth
				if (process.env.NODE_ENV === "development") {
					logger.debug("Checking for Discord account to sync");
				}
				const result = await grantDiscordAccess();

				if (result.success) {
					logger.info("Discord data synced successfully", {
						userId: user.id,
					});
					setStep(3); // Move to next step
				} else if (result.needsConnection) {
					// User hasn't connected Discord yet - stay on step 2
					if (process.env.NODE_ENV === "development") {
						logger.debug("User needs to connect Discord first");
					}
				} else if (result.noSubscription) {
					if (process.env.NODE_ENV === "development") {
						logger.debug("Discord OAuth without eligible access", {
							error: result.error,
						});
					}
				} else if (result.error) {
					if (process.env.NODE_ENV === "development") {
						logger.debug("Discord sync issue", {
							error: result.error,
						});
					}
				}
			} catch (error) {
				logger.error("Failed to check Discord status", { error });
			}
		}

		syncDiscordData();
	}, [onboardingStep, searchParams]); // Rerun when step or URL changes

	const setStep = (step: number) => {
		router.replace(
			withQuery(window.location.pathname, {
				step,
			}),
		);
	};

	const onCompleted = async () => {
		await clearCache();
		router.replace(redirectTo ?? "/app/community");
	};

	const steps = [
		{
			component: <OnboardingStep1 onCompleted={() => setStep(2)} />,
		},
		{
			component: (
				<OnboardingStep2Discord
					onCompleted={() => setStep(3)}
					onSkip={() => setStep(3)}
				/>
			),
		},
		{
			component: (
				<OnboardingStep3Success onCompleted={() => onCompleted()} />
			),
		},
	];

	return (
		<div>
			<h1 className="font-serif font-bold text-xl tracking-tight md:text-2xl">
				{t("onboarding.title")}
			</h1>
			<p className="mt-2 mb-6 text-muted-foreground">
				{t("onboarding.message")}
			</p>

			{/* Progress Indicator */}
			<div className="mb-6 flex items-center gap-3">
				<Progress
					value={(onboardingStep / steps.length) * 100}
					className="h-2"
				/>
				<span className="shrink-0 text-muted-foreground text-xs">
					{t("onboarding.step", {
						step: onboardingStep,
						total: steps.length,
					})}
				</span>
			</div>

			{/* Back Button (if not on first step) */}
			{onboardingStep > 1 && onboardingStep < 3 && (
				<button
					onClick={() => setStep(onboardingStep - 1)}
					className="mb-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
					type="button"
				>
					<svg
						className="w-4 h-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<title>Back</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
					Back
				</button>
			)}

			{/* Current Step Component */}
			{steps[onboardingStep - 1].component}
		</div>
	);
}
