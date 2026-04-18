"use client";

import { logger } from "@repo/logs";
import { Logo } from "@shared/components/Logo";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getRewardfulAttribution } from "@/lib/rewardful-checkout";
import {
	AlertCircle,
	Loader2,
	Lock,
	Shield,
	Sparkles,
	X,
} from "@/modules/ui/icons";

interface PromoData {
	name: string;
	price: string;
	period: string;
	description: string;
	features: string[];
	badge: string | null;
	stripePriceId: string | null;
	allowPromoCodes: boolean;
}

interface PromoCheckoutClientProps {
	promo: PromoData | null;
}

export function PromoCheckoutClient({ promo }: PromoCheckoutClientProps) {
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!promo || !promo.stripePriceId) {
			setError(
				"No active promotion is currently running. Please check back later.",
			);
			setIsLoading(false);
			return;
		}

		let timeoutId: NodeJS.Timeout;
		const abortController = new AbortController();

		async function createCheckout() {
			try {
				timeoutId = setTimeout(() => {
					abortController.abort();
					setError(
						"Checkout is taking longer than expected. Please try again.",
					);
					setIsLoading(false);
					toast.error("Checkout timeout", {
						description:
							"Please try again or contact support if the issue persists.",
					});
				}, 10000);

				const { referralId, affiliateToken } =
					await getRewardfulAttribution();

				const response = await fetch("/api/checkout/create", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						plan: `promo-${promo?.name.toLowerCase().replace(/\s+/g, "-")}`,
						priceId: promo?.stripePriceId,
						allowPromoCodes: promo?.allowPromoCodes,
						...(referralId ? { referral: referralId } : {}),
						...(affiliateToken ? { affiliateToken } : {}),
					}),
					signal: abortController.signal,
				});

				clearTimeout(timeoutId);

				if (abortController.signal.aborted) {
					return;
				}

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(errorData.message || "Checkout failed");
				}

				const { checkoutUrl } = await response.json();

				if (!checkoutUrl) {
					throw new Error("No checkout URL received");
				}

				toast.success("Redirecting to secure checkout...");
				window.location.href = checkoutUrl;
			} catch (err) {
				clearTimeout(timeoutId);
				if (abortController.signal.aborted) {
					return;
				}
				logger.error("Promo checkout error", { error: err });
				const errorMessage =
					err instanceof Error
						? err.message
						: "Failed to create checkout session";
				setError(errorMessage);
				setIsLoading(false);
				toast.error("Checkout Error", {
					description: errorMessage,
				});
			}
		}

		createCheckout();

		return () => {
			clearTimeout(timeoutId);
			abortController.abort();
		};
	}, [promo]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<div className="w-full max-w-md space-y-6 text-center">
				{/* Logo */}
				<div className="flex justify-center">
					<Logo withLabel={true} />
				</div>

				{/* Loading State */}
				{isLoading && !error && (
					<>
						<div className="rounded-xl border border-border bg-card p-6 shadow-flat">
							{promo ? (
								<>
									{promo.badge && (
										<div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
											<Sparkles className="h-3 w-3" />
											{promo.badge}
										</div>
									)}
									<div className="mb-4 flex items-center justify-between">
										<h2 className="font-serif text-lg font-bold text-foreground">
											{promo.name}
										</h2>
										<div className="text-right">
											<span className="text-2xl font-bold text-foreground">
												{promo.price}
											</span>
											<span className="text-sm text-muted-foreground">
												{promo.period}
											</span>
										</div>
									</div>
									{promo.description && (
										<p className="mb-4 text-sm text-muted-foreground text-left">
											{promo.description}
										</p>
									)}
									<ul className="mb-4 text-left text-sm text-muted-foreground flex flex-col gap-2">
										{promo.features.map((feature) => (
											<li
												key={feature}
												className="flex items-center gap-2"
											>
												<Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
												{feature}
											</li>
										))}
									</ul>
								</>
							) : (
								<div className="py-4">
									<p className="text-sm text-muted-foreground">
										Loading promotion details...
									</p>
								</div>
							)}
							<div className="border-t border-border pt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin text-primary" />
								<span>Redirecting to secure checkout...</span>
							</div>
						</div>

						{/* Trust Badges */}
						<div className="flex items-center justify-center gap-6 pt-2">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Lock className="h-4 w-4 text-primary" />
								<span>256-bit SSL</span>
							</div>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<svg
									className="h-4 w-4 text-primary"
									viewBox="0 0 24 24"
									fill="currentColor"
									aria-hidden="true"
								>
									<path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
								</svg>
								<span>Powered by Stripe</span>
							</div>
						</div>

						{/* Cancel Button */}
						<div className="pt-2">
							<Button
								variant="ghost"
								asChild
								className="text-muted-foreground hover:text-foreground"
							>
								<Link href="/#pricing">
									<X className="mr-2 h-4 w-4" />
									Cancel
								</Link>
							</Button>
						</div>
					</>
				)}

				{/* Error State */}
				{error && (
					<div className="space-y-4">
						<Alert variant="error">
							<AlertCircle className="h-4 w-4" />
							<AlertTitle>Checkout Error</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>

						<div className="flex flex-col gap-3">
							<Button
								onClick={() => {
									setError(null);
									setIsLoading(true);
									window.location.reload();
								}}
								className="w-full"
							>
								Try Again
							</Button>
							<Button
								variant="outline"
								asChild
								className="w-full"
							>
								<Link href="/#pricing">Return to Pricing</Link>
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
