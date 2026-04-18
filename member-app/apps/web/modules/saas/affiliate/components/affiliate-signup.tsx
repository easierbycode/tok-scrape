"use client";

import { Alert, AlertDescription } from "@ui/components/alert";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Checkbox } from "@ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { cn } from "@ui/lib";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { orpcClient } from "@/modules/shared/lib/orpc-client";
import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	CheckCircle2,
	Info,
	Link2,
	Sparkles,
	UserPlus,
} from "@/modules/ui/icons";

type AffiliateType = "new" | "existing";
type ModalStep = "form" | "confirm";

interface LookupResult {
	found: boolean;
	affiliateFirstName?: string;
	alreadyLinked?: boolean;
}

const BENEFITS = [
	"50% recurring commission on all referrals",
	"Unique referral link to track your performance",
	"Real-time analytics dashboard",
	"Monthly payouts via PayPal",
];

function resetModalState(
	setEmail: (v: string) => void,
	setAgreedToTerms: (v: boolean) => void,
	setAffiliateType: (v: AffiliateType | null) => void,
	setModalStep: (v: ModalStep) => void,
	setLookupResult: (v: LookupResult | null) => void,
	setError: (v: string | null) => void,
	setIsLoading: (v: boolean) => void,
) {
	setEmail("");
	setAgreedToTerms(false);
	setAffiliateType(null);
	setModalStep("form");
	setLookupResult(null);
	setError(null);
	setIsLoading(false);
}

export function AffiliateSignup() {
	const _router = useRouter();
	const [email, setEmail] = useState("");
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [affiliateType, setAffiliateType] = useState<AffiliateType | null>(
		null,
	);
	const [modalStep, setModalStep] = useState<ModalStep>("form");
	const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showSignupModal, setShowSignupModal] = useState(false);

	useEffect(() => {
		if (!showSignupModal) {
			resetModalState(
				setEmail,
				setAgreedToTerms,
				setAffiliateType,
				setModalStep,
				setLookupResult,
				setError,
				setIsLoading,
			);
		}
	}, [showSignupModal]);

	const handleFormSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!affiliateType) {
			return;
		}
		setError(null);
		setIsLoading(true);

		try {
			const result = await orpcClient.users.affiliate.lookup({ email });
			setLookupResult(result);
			setModalStep("confirm");
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to look up email",
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfirm = async () => {
		setError(null);
		setIsLoading(true);

		try {
			const result = await orpcClient.users.affiliate.create({
				email,
				agreedToTerms,
			});

			if (result.success) {
				if (result.isExistingAffiliate) {
					toast.success(
						"Affiliate account connected! Your earnings have been synced.",
					);
				} else {
					toast.success("Affiliate account created successfully!");
				}
				setShowSignupModal(false);
				window.location.reload();
			}
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to create affiliate account",
			);
			setIsLoading(false);
		}
	};

	const handleGoBack = () => {
		setModalStep("form");
		setLookupResult(null);
		setError(null);
	};

	const emailHelperText =
		affiliateType === "existing"
			? "Enter the exact email address registered to your Rewardful account."
			: "We'll use this email to set up your Rewardful account and process payouts.";

	const submitButtonText =
		affiliateType === "new"
			? "Create My Account"
			: affiliateType === "existing"
				? "Connect My Account"
				: "Continue";

	const loadingText =
		affiliateType === "existing"
			? "Looking up your account..."
			: "Setting up your account...";

	const isNew = affiliateType === "new";
	const found = lookupResult?.found ?? false;
	const alreadyLinked = lookupResult?.alreadyLinked ?? false;

	const confirmScenario = alreadyLinked
		? "already-linked"
		: isNew && !found
			? "new-not-found"
			: isNew && found
				? "new-found"
				: !isNew && found
					? "existing-found"
					: "existing-not-found";

	return (
		<>
			{/* Hero Section */}
			<section
				className="container mx-auto px-4 py-8 sm:py-12 md:py-16 lg:pt-0 lg:pb-20 min-h-[calc(100vh-120px)] flex items-center"
				aria-labelledby="hero-heading"
			>
				<div className="flex flex-col lg:grid lg:grid-cols-2 gap-8 md:gap-10 lg:gap-12 items-center max-w-7xl mx-auto w-full">
					{/* Left Column */}
					<div className="order-2 lg:order-1 space-y-5 md:space-y-6 text-center lg:text-left">
						<h1
							id="hero-heading"
							className="font-serif font-bold tracking-tight text-balance text-4xl sm:text-5xl md:text-6xl lg:text-6xl"
						>
							Join the Affiliate Program
						</h1>

						<p className="text-lg md:text-xl text-muted-foreground text-pretty leading-relaxed">
							Earn 50% recurring commission on every customer you
							refer. Share your unique link, and get paid monthly
							for as long as they stay subscribed.
						</p>

						<div className="space-y-4 pt-4 flex flex-col items-center lg:items-start">
							<Button
								size="lg"
								className="bg-primary hover:bg-primary/90 text-primary-foreground text-base sm:text-lg px-8 sm:px-10 py-6 sm:py-7 shadow-brand-glow md:shadow-brand-glow-desktop transition-[background-color,color,border-color]"
								onClick={() => setShowSignupModal(true)}
							>
								Become an Affiliate{" "}
								<ArrowRight
									className="ml-2 w-5 h-5"
									aria-hidden="true"
								/>
							</Button>
							<p className="text-sm text-muted-foreground text-center lg:text-left">
								Start earning in minutes
							</p>
						</div>
					</div>

					{/* Right Column - Card */}
					<div className="order-1 lg:order-2 flex justify-center lg:justify-end">
						<button
							type="button"
							onClick={() => setShowSignupModal(true)}
							className="group relative w-full max-w-sm sm:max-w-md aspect-[1.586/1] rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary p-1 shadow-raised transition-[transform,box-shadow] duration-500 hover:scale-105 hover:shadow-elevated md:hover:shadow-elevated-desktop focus:outline-none focus:ring-4 focus:ring-primary focus:ring-offset-4"
							aria-label="Open affiliate signup form"
						>
							<div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[#1a1d24] to-[#0d1116] p-6 sm:p-6 md:p-8 flex flex-col justify-center overflow-hidden">
								<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
								<div className="relative z-10 space-y-2 sm:space-y-3 md:space-y-4">
									<div className="flex items-center gap-2">
										<Sparkles className="w-6 h-6 text-primary" />
										<span className="text-xs sm:text-sm font-semibold text-primary uppercase tracking-wider">
											Exclusive Access
										</span>
									</div>
									<h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
										Affiliate Member
									</h3>
									<p className="text-gray-300 text-base sm:text-lg">
										Premium partnership program
									</p>
								</div>
								<div className="absolute top-8 right-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl" />
								<div className="absolute bottom-8 left-8 w-24 h-24 bg-primary/30 rounded-full blur-2xl" />
							</div>
						</button>
					</div>
				</div>
			</section>

			{/* Signup Modal */}
			<Dialog open={showSignupModal} onOpenChange={setShowSignupModal}>
				<DialogContent className="sm:max-w-md">
					{modalStep === "form" ? (
						<>
							<DialogHeader>
								<DialogTitle className="font-serif font-bold tracking-tight text-2xl text-center">
									Join the Affiliate Program
								</DialogTitle>
								<DialogDescription className="text-center">
									Earn 50% commission on every referral.
									Choose how you'd like to get started.
								</DialogDescription>
							</DialogHeader>

							<div className="space-y-6">
								{/* Key Benefits */}
								<ul
									className="space-y-3 p-4 rounded-lg bg-muted/50"
									aria-label="Program benefits"
								>
									{BENEFITS.map((benefit, index) => (
										<li
											key={index}
											className="flex items-start gap-3"
										>
											<CheckCircle2
												className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
												aria-hidden="true"
											/>
											<span className="text-sm text-foreground">
												{benefit}
											</span>
										</li>
									))}
								</ul>

								{/* Form */}
								<form
									onSubmit={handleFormSubmit}
									className="space-y-5"
								>
									{/* Account type selection — card buttons */}
									<div className="space-y-2">
										<Label>
											How would you like to join?
										</Label>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											<button
												type="button"
												onClick={() =>
													setAffiliateType("new")
												}
												className={cn(
													"flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-[background-color,border-color,color]",
													affiliateType === "new"
														? "border-primary bg-primary/5"
														: "border-border hover:border-primary/40 hover:bg-muted/50",
												)}
											>
												<div className="flex items-center gap-2">
													<UserPlus
														className={cn(
															"h-4 w-4",
															affiliateType ===
																"new"
																? "text-primary"
																: "text-muted-foreground",
														)}
													/>
													<span className="font-semibold text-sm">
														Create Rewardful Account
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													New to our affiliate program
												</p>
											</button>

											<button
												type="button"
												onClick={() =>
													setAffiliateType("existing")
												}
												className={cn(
													"flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-[background-color,border-color,color]",
													affiliateType === "existing"
														? "border-primary bg-primary/5"
														: "border-border hover:border-primary/40 hover:bg-muted/50",
												)}
											>
												<div className="flex items-center gap-2">
													<Link2
														className={cn(
															"h-4 w-4",
															affiliateType ===
																"existing"
																? "text-primary"
																: "text-muted-foreground",
														)}
													/>
													<span className="font-semibold text-sm">
														Connect Rewardful
														Account
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
													Already on Rewardful? Link
													your account
												</p>
											</button>
										</div>
									</div>

									<div className="space-y-2">
										<Label htmlFor="affiliate-email">
											Email{" "}
											<span
												className="text-destructive"
												aria-hidden="true"
											>
												*
											</span>
											<span className="sr-only">
												(required)
											</span>
										</Label>
										<Input
											id="affiliate-email"
											type="email"
											placeholder="your@email.com"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											required
											disabled={
												isLoading || !affiliateType
											}
											aria-required="true"
											aria-describedby="email-description"
										/>
										{affiliateType && (
											<p
												id="email-description"
												className="text-xs text-muted-foreground"
											>
												{emailHelperText}
											</p>
										)}
									</div>

									<div className="flex items-start gap-3">
										<Checkbox
											id="terms"
											checked={agreedToTerms}
											onCheckedChange={(checked) =>
												setAgreedToTerms(
													checked === true,
												)
											}
											disabled={isLoading}
											aria-required="true"
											aria-describedby="terms-description"
										/>
										<Label
											htmlFor="terms"
											className="text-sm leading-relaxed cursor-pointer font-normal"
										>
											I agree to the{" "}
											<a
												href="/legal/affiliate-terms"
												className="text-primary hover:underline"
												target="_blank"
												rel="noopener noreferrer"
												onClick={(e) =>
													e.stopPropagation()
												}
											>
												affiliate terms and conditions
											</a>
										</Label>
										<span
											id="terms-description"
											className="sr-only"
										>
											You must agree to the terms and
											conditions to proceed
										</span>
									</div>

									{error && (
										<Alert variant="error">
											<AlertCircle
												className="h-4 w-4"
												aria-hidden="true"
											/>
											<AlertDescription>
												{error}
											</AlertDescription>
										</Alert>
									)}

									<Button
										type="submit"
										disabled={
											!affiliateType ||
											!agreedToTerms ||
											!email ||
											isLoading
										}
										className="w-full"
										size="lg"
										variant="primary"
										aria-busy={isLoading}
									>
										{isLoading
											? loadingText
											: submitButtonText}
										{!isLoading && (
											<ArrowRight className="ml-2 w-4 h-4" />
										)}
									</Button>
								</form>
							</div>
						</>
					) : (
						<>
							{/* Confirmation Step */}
							<div className="space-y-6">
								{confirmScenario === "already-linked" ? (
									<div className="space-y-4">
										<div className="flex justify-center">
											<AlertCircle className="h-12 w-12 text-destructive" />
										</div>
										<div className="text-center space-y-2">
											<h3 className="font-serif font-semibold tracking-tight text-xl">
												Account Already Connected
											</h3>
											<p className="text-sm text-muted-foreground">
												This affiliate account is
												already connected to another
												user. Please contact support if
												you believe this is an error.
											</p>
										</div>
										<Badge
											status="info"
											className="w-full justify-center py-2"
										>
											{email}
										</Badge>
										<Button
											variant="outline"
											className="w-full"
											onClick={handleGoBack}
										>
											<ArrowLeft className="mr-2 w-4 h-4" />
											Try Different Email
										</Button>
									</div>
								) : (
									<>
										<div className="flex justify-center">
											{confirmScenario ===
												"new-not-found" ||
											confirmScenario ===
												"existing-found" ? (
												<CheckCircle2 className="h-12 w-12 text-green-500" />
											) : (
												<Info className="h-12 w-12 text-amber-500" />
											)}
										</div>

										<div className="text-center space-y-2">
											<h3 className="font-serif font-semibold tracking-tight text-xl">
												{confirmScenario ===
												"new-not-found"
													? "Ready to Create Your Account"
													: confirmScenario ===
															"new-found"
														? "Account Already Exists"
														: confirmScenario ===
																"existing-found"
															? "Account Found"
															: "No Account Found"}
											</h3>
											<p className="text-sm text-muted-foreground">
												{confirmScenario ===
												"new-not-found"
													? "We'll create your Rewardful affiliate account with this email. Your unique referral link will be ready immediately."
													: confirmScenario ===
															"new-found"
														? "We found an existing Rewardful affiliate account registered to this email. Would you like to connect it to your profile instead?"
														: confirmScenario ===
																"existing-found"
															? "We found your Rewardful affiliate account. Your referral history and earnings will be synced to your profile."
															: "We couldn't find a Rewardful account with that email. Double-check your email, or we can create a new affiliate account for you."}
											</p>
										</div>

										<Badge
											status="info"
											className="w-full justify-center py-2"
										>
											{email}
										</Badge>

										{error && (
											<Alert variant="error">
												<AlertCircle
													className="h-4 w-4"
													aria-hidden="true"
												/>
												<AlertDescription>
													{error}
												</AlertDescription>
											</Alert>
										)}

										<div className="flex flex-col gap-2">
											<Button
												onClick={handleConfirm}
												disabled={isLoading}
												className="w-full"
												size="lg"
												variant="primary"
												aria-busy={isLoading}
											>
												{isLoading
													? confirmScenario ===
															"existing-found" ||
														confirmScenario ===
															"new-found"
														? "Connecting your account..."
														: "Creating your account..."
													: confirmScenario ===
															"new-not-found"
														? "Create My Account"
														: confirmScenario ===
																"existing-not-found"
															? "Create New Account"
															: "Connect My Account"}
												{!isLoading && (
													<ArrowRight className="ml-2 w-4 h-4" />
												)}
											</Button>
											<Button
												variant="ghost"
												className="w-full"
												onClick={handleGoBack}
												disabled={isLoading}
											>
												<ArrowLeft className="mr-2 w-4 h-4" />
												{confirmScenario ===
												"existing-not-found"
													? "Try Different Email"
													: "Go Back"}
											</Button>
										</div>
									</>
								)}
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
