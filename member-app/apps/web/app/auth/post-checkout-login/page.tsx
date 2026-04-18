"use client";

import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import { Button } from "@ui/components/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ArrowRightIcon,
	CheckCircleIcon,
	Loader2,
	MailIcon,
	RefreshCwIcon,
	XCircleIcon,
} from "@/modules/ui/icons";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_RESENDS = 3;

type PageStatus = "loading" | "sent" | "activated" | "error";

function getLoadingMessage(attempt: number): string {
	if (attempt <= 2) {
		return "This will only take a moment";
	}
	if (attempt <= 4) {
		return "Still working, almost there...";
	}
	return "Taking a bit longer than expected...";
}

export default function PostCheckoutLoginPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [status, setStatus] = useState<PageStatus>("loading");
	const [email, setEmail] = useState<string | null>(null);
	const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(1);
	const [resendCount, setResendCount] = useState(0);
	const [resendCooldown, setResendCooldown] = useState(0);
	const [resendStatus, setResendStatus] = useState<
		"idle" | "sending" | "sent" | "error"
	>("idle");
	const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const startCooldown = useCallback(() => {
		setResendCooldown(RESEND_COOLDOWN_SECONDS);
		if (cooldownRef.current) {
			clearInterval(cooldownRef.current);
		}
		cooldownRef.current = setInterval(() => {
			setResendCooldown((prev) => {
				if (prev <= 1) {
					if (cooldownRef.current) {
						clearInterval(cooldownRef.current);
					}
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
	}, []);

	useEffect(() => {
		return () => {
			if (cooldownRef.current) {
				clearInterval(cooldownRef.current);
			}
		};
	}, []);

	const sendMagicLink = useCallback(
		async (targetEmail: string): Promise<boolean> => {
			try {
				const response = await fetch("/api/auth/sign-in/magic-link", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: targetEmail,
						callbackURL: "/onboarding",
					}),
				});
				return response.ok;
			} catch (err) {
				logger.error("Failed to send magic link", { error: err });
				return false;
			}
		},
		[],
	);

	const handleResend = useCallback(async () => {
		if (!email || resendCooldown > 0 || resendCount >= MAX_RESENDS) {
			return;
		}

		setResendStatus("sending");
		const success = await sendMagicLink(email);

		if (success) {
			logger.info("Magic link resent", {
				email,
				resendCount: resendCount + 1,
			});
			setResendCount((prev) => prev + 1);
			setResendStatus("sent");
			startCooldown();
			setTimeout(() => setResendStatus("idle"), 3000);
		} else {
			setResendStatus("error");
			setTimeout(() => setResendStatus("idle"), 3000);
		}
	}, [email, resendCooldown, resendCount, sendMagicLink, startCooldown]);

	useEffect(() => {
		async function verifyAndSendLink() {
			const sessionId = searchParams.get("session_id");

			if (process.env.NODE_ENV === "development") {
				logger.debug("Post-checkout login starting", {
					sessionId: `${sessionId?.substring(0, 20)}...`,
				});
			}

			if (!sessionId) {
				logger.error("No session_id in URL");
				setStatus("error");
				return;
			}

			for (
				let currentAttempt = 1;
				currentAttempt <= MAX_RETRIES;
				currentAttempt++
			) {
				setAttempt(currentAttempt);

				if (process.env.NODE_ENV === "development") {
					logger.debug(
						`Attempt ${currentAttempt}/${MAX_RETRIES}: Validating checkout`,
					);
				}

				try {
					const validateResponse = await fetch(
						"/api/auth/validate-checkout",
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ sessionId }),
							credentials: "include",
						},
					);

					if (process.env.NODE_ENV === "development") {
						logger.debug("Validate response", {
							status: validateResponse.status,
							ok: validateResponse.ok,
						});
					}

					if (validateResponse.status === 202) {
						if (currentAttempt < MAX_RETRIES) {
							if (process.env.NODE_ENV === "development") {
								logger.debug(
									`Webhook still processing (202)... waiting ${RETRY_DELAY_MS}ms (attempt ${currentAttempt}/${MAX_RETRIES})`,
								);
							}
							await new Promise((resolve) =>
								setTimeout(resolve, RETRY_DELAY_MS),
							);
							continue;
						}

						logger.error(
							"Max retries reached, webhook still processing",
							{
								attempt: currentAttempt,
								maxRetries: MAX_RETRIES,
							},
						);
						setStatus("error");
						return;
					}

					if (validateResponse.ok) {
						const data = await validateResponse.json();
						if (process.env.NODE_ENV === "development") {
							logger.debug("User verified", {
								email: data.email,
							});
						}

						// Check if the user already has an active session for this email.
						// If so, skip the magic link — they're already logged in and the
						// subscription is visible immediately from the DB.
						const { data: sessionData } =
							await authClient.getSession();
						if (
							sessionData?.user?.email &&
							sessionData.user.email.toLowerCase() ===
								data.email.toLowerCase()
						) {
							logger.info(
								"Existing session matches purchaser — skipping magic link",
							);
							setEmail(data.email);
							setMaskedEmail(data.maskedEmail ?? null);
							setStatus("activated");
							return;
						}

						const sent = await sendMagicLink(data.email);

						if (sent) {
							logger.info("Magic link sent successfully");
							setEmail(data.email);
							setMaskedEmail(data.maskedEmail ?? null);
							setStatus("sent");
							startCooldown();
							return;
						}

						logger.error("Failed to send magic link");
						setEmail(data.email);
						setMaskedEmail(data.maskedEmail ?? null);
						setStatus("error");
						return;
					}

					logger.error("Validation failed", {
						status: validateResponse.status,
						attempt: currentAttempt,
						maxRetries: MAX_RETRIES,
					});

					const _errorData = await validateResponse
						.json()
						.catch(() => ({}));

					if (process.env.NODE_ENV === "development") {
						logger.debug("Validation failed, showing error");
					}

					setStatus("error");
					return;
				} catch (error) {
					logger.error("Post-checkout login error on attempt", {
						attempt: currentAttempt,
						error,
					});
					if (currentAttempt === MAX_RETRIES) {
						setStatus("error");
						return;
					}
					if (process.env.NODE_ENV === "development") {
						logger.debug(
							`Waiting ${RETRY_DELAY_MS}ms before retry`,
						);
					}
					await new Promise((resolve) =>
						setTimeout(resolve, RETRY_DELAY_MS),
					);
				}
			}
		}

		verifyAndSendLink();
	}, [searchParams, sendMagicLink, startCooldown]);

	if (status === "loading") {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
					<h2 className="mb-2 font-serif text-xl font-semibold tracking-tight">
						Setting up your account...
					</h2>
					<p className="text-muted-foreground">
						{getLoadingMessage(attempt)}
					</p>
				</div>
			</div>
		);
	}

	if (status === "activated") {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="max-w-md text-center px-4">
					<CheckCircleIcon className="mx-auto mb-4 h-12 w-12 text-primary" />
					<h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight">
						You&apos;re all set!
					</h2>
					<p className="mb-8 text-muted-foreground">
						{maskedEmail
							? `Your subscription is active on ${maskedEmail}.`
							: "Your subscription is now active."}{" "}
						Head to the community to connect your Discord and get
						started.
					</p>
					<Button
						size="lg"
						className="w-full"
						onClick={() => router.push("/app/community")}
					>
						Go to Community
						<ArrowRightIcon className="ml-2 h-4 w-4" />
					</Button>
				</div>
			</div>
		);
	}

	if (status === "sent") {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="max-w-md text-center px-4">
					<MailIcon className="mx-auto mb-4 h-12 w-12 text-primary" />
					<h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight">
						Check Your Email
					</h2>
					<p className="mb-6 text-muted-foreground">
						{maskedEmail
							? `We've sent a login link to ${maskedEmail}. Click the link in your email to access your account.`
							: "We've sent you a login link. Click the link in your email to access your account."}
					</p>

					<div className="mb-6">
						{resendCount >= MAX_RESENDS ? (
							<p className="text-sm text-muted-foreground">
								Maximum resend attempts reached. Please check
								your spam folder or{" "}
								<Link
									href="/contact"
									className="text-primary underline"
								>
									contact support
								</Link>
								.
							</p>
						) : (
							<Button
								variant="outline"
								onClick={handleResend}
								disabled={
									resendCooldown > 0 ||
									resendStatus === "sending"
								}
							>
								{resendStatus === "sending" ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Sending...
									</>
								) : resendStatus === "sent" ? (
									<>
										<CheckCircleIcon className="mr-2 h-4 w-4 text-green-500" />
										Link resent!
									</>
								) : resendStatus === "error" ? (
									<>
										<XCircleIcon className="mr-2 h-4 w-4 text-destructive" />
										Failed to resend
									</>
								) : resendCooldown > 0 ? (
									<>
										<RefreshCwIcon className="mr-2 h-4 w-4" />
										Resend in {resendCooldown}s
									</>
								) : (
									<>
										<RefreshCwIcon className="mr-2 h-4 w-4" />
										Resend magic link
									</>
								)}
							</Button>
						)}
					</div>

					<p className="text-sm text-muted-foreground">
						Didn&apos;t receive it? Check your spam folder or{" "}
						<Link
							href="/contact"
							className="text-primary underline"
						>
							contact support
						</Link>
						.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="max-w-md text-center px-4">
				<XCircleIcon className="mx-auto mb-4 h-12 w-12 text-destructive" />
				<h2 className="mb-4 font-serif text-3xl font-semibold tracking-tight">
					Something Went Wrong
				</h2>
				<p className="mb-6 text-muted-foreground">
					We couldn&apos;t complete your account setup. Please try
					refreshing the page or contact support if the issue
					persists.
				</p>
				<div className="flex flex-col sm:flex-row justify-center gap-3">
					<Button
						variant="outline"
						onClick={() => window.location.reload()}
					>
						<RefreshCwIcon className="mr-2 h-4 w-4" />
						Try Again
					</Button>
					<Button asChild>
						<Link href="/contact">
							Contact Support
							<ArrowRightIcon className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
