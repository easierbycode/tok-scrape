"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { logger } from "@repo/logs";
import { UserAvatarUpload } from "@saas/settings/components/UserAvatarUpload";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@ui/components/popover";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { getUser, updateUserProfile } from "@/lib/onboarding-api";
import { ArrowRightIcon, EyeIcon, EyeOffIcon, Info } from "@/modules/ui/icons";

const formSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	username: z.string().optional(),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(64, "Password must be less than 64 characters")
		.optional()
		.or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

// Calculate password strength (NIST guidelines - length over complexity)
function calculatePasswordStrength(password: string) {
	if (!password) {
		return { score: 0, label: "Weak", color: "red" };
	}

	let score = 0;

	// Length is most important (NIST recommendation)
	if (password.length >= 8) {
		score++;
	}
	if (password.length >= 12) {
		score++;
	}
	if (password.length >= 16) {
		score++;
	}

	// Character variety (secondary factor)
	const hasLower = /[a-z]/.test(password);
	const hasUpper = /[A-Z]/.test(password);
	const hasNumber = /[0-9]/.test(password);
	const hasSymbol = /[^a-zA-Z0-9]/.test(password);
	const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(
		Boolean,
	).length;

	if (variety >= 3) {
		score++;
	}

	const strengthMap = [
		{ score: 0, label: "Very Weak", color: "red" },
		{ score: 1, label: "Weak", color: "orange" },
		{ score: 2, label: "Fair", color: "yellow" },
		{ score: 3, label: "Good", color: "lime" },
		{ score: 4, label: "Strong", color: "green" },
	];

	return strengthMap[score];
}

export function OnboardingStep1({ onCompleted }: { onCompleted: () => void }) {
	const t = useTranslations();
	const [_user, setUser] = useState<any>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [hasCredentialAccount, setHasCredentialAccount] = useState(false);
	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			firstName: "",
			lastName: "",
			username: "",
			password: "",
		},
	});

	// Load current user data on mount for pre-fill (optional UX feature)
	useEffect(() => {
		async function loadUser() {
			const [userData, accountsResult] = await Promise.all([
				getUser(),
				authClient.listAccounts().catch(() => ({ data: null })),
			]);

			// Handle null - session may not be ready yet on initial mount
			if (!userData) {
				if (process.env.NODE_ENV === "development") {
					logger.debug(
						"Session not ready for pre-fill, user can still submit form",
					);
				}
				return;
			}
			setUser(userData);

			// Check if user already has a password (credential account)
			const accounts = accountsResult?.data ?? [];
			const credentialAccount = Array.isArray(accounts)
				? accounts.find(
						(a: { providerId: string }) =>
							a.providerId === "credential",
					)
				: null;
			setHasCredentialAccount(!!credentialAccount);

			// Pre-fill if data exists
			if (userData.firstName) {
				form.setValue("firstName", userData.firstName);
			}
			if (userData.lastName) {
				form.setValue("lastName", userData.lastName);
			}
			if (userData.username) {
				form.setValue("username", userData.username);
			}
			// If only name exists, try to split it
			else if (userData.name && !userData.firstName) {
				const [firstName, ...lastNameParts] = userData.name.split(" ");
				form.setValue("firstName", firstName || "");
				form.setValue("lastName", lastNameParts.join(" ") || "");
			}
		}
		loadUser();
	}, []);

	const onSubmit: SubmitHandler<FormValues> = async (values) => {
		form.clearErrors("root");

		try {
			const updateData = {
				firstName: values.firstName,
				lastName: values.lastName,
				username: values.username || undefined,
				name: `${values.firstName} ${values.lastName}`, // Computed full name
			};

			// If password provided and meets minimum length, set it
			if (values.password && values.password.length >= 8) {
				try {
					await authClient.changePassword({
						newPassword: values.password,
						currentPassword: "", // Empty for initial password setup
					});
				} catch (error) {
					logger.error("Failed to set password", { error });
					// Continue anyway - password is optional
				}
			}

			await updateUserProfile(updateData);

			onCompleted();
		} catch {
			form.setError("root", {
				type: "server",
				message: t("onboarding.notifications.accountSetupFailed"),
			});
		}
	};

	return (
		<div>
			<Form {...form}>
				<form
					className="flex flex-col items-stretch gap-6"
					onSubmit={form.handleSubmit(onSubmit)}
				>
					{/* First Name */}
					<FormField
						control={form.control}
						name="firstName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>First Name</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="John"
										className="h-12"
									/>
								</FormControl>
							</FormItem>
						)}
					/>

					{/* Last Name */}
					<FormField
						control={form.control}
						name="lastName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Last Name</FormLabel>
								<FormControl>
									<Input
										{...field}
										placeholder="Doe"
										className="h-12"
									/>
								</FormControl>
							</FormItem>
						)}
					/>

					{/* Avatar Upload */}
					<FormItem className="flex items-center justify-between gap-4">
						<div>
							<FormLabel>
								{t("onboarding.account.avatar")}
							</FormLabel>

							<FormDescription>
								{t("onboarding.account.avatarDescription")}
							</FormDescription>
						</div>
						<FormControl>
							<UserAvatarUpload
								onSuccess={() => {
									return;
								}}
								onError={() => {
									return;
								}}
							/>
						</FormControl>
					</FormItem>

					<div className="border-t pt-4">
						<p className="text-muted-foreground text-sm mb-4">
							These are optional and can be configured later in
							Settings.
						</p>

						{/* Username (Optional) */}
						<div className="flex flex-col gap-6">
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											Username{" "}
											<span className="text-muted-foreground font-normal">
												(Optional)
											</span>
										</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="johndoe"
												className="h-12"
											/>
										</FormControl>
										<FormDescription>
											Your public display name in the
											community. This is separate from
											your Discord username.
										</FormDescription>
									</FormItem>
								)}
							/>

							{/* Password — hidden if user already has a credential account */}
							{hasCredentialAccount ? (
								<div className="rounded-lg bg-muted/50 border px-4 py-3 text-sm text-muted-foreground">
									Password already set. You can update it
									anytime in{" "}
									<span className="font-medium text-foreground">
										Settings → Security
									</span>
									.
								</div>
							) : (
								<FormField
									control={form.control}
									name="password"
									render={({ field }) => {
										const strength =
											calculatePasswordStrength(
												field.value || "",
											);

										return (
											<FormItem>
												<FormDescription className="text-sm mb-2">
													You're currently using magic
													link sign-in. Add a password
													only if you'd also like to
													log in with email and
													password.
												</FormDescription>
												<FormLabel>
													Password{" "}
													<span className="text-muted-foreground font-normal text-sm">
														(Optional)
													</span>
												</FormLabel>
												<FormControl>
													<div className="space-y-2">
														<div className="relative">
															<Input
																{...field}
																type={
																	showPassword
																		? "text"
																		: "password"
																}
																placeholder="Create a password"
																className="h-12 pr-20"
																onChange={(
																	e,
																) => {
																	field.onChange(
																		e,
																	);
																}}
															/>
															<div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
																<Popover>
																	<PopoverTrigger
																		asChild
																	>
																		<button
																			type="button"
																			className="text-muted-foreground hover:text-foreground"
																		>
																			<Info className="h-4 w-4" />
																		</button>
																	</PopoverTrigger>
																	<PopoverContent className="w-72 sm:w-80">
																		<div className="space-y-2">
																			<p className="font-semibold text-sm">
																				Password
																				Tips:
																			</p>
																			<ul className="text-sm space-y-1 text-muted-foreground">
																				<li>
																					•
																					Longer
																					is
																					better
																					(12+
																					characters
																					recommended)
																				</li>
																				<li>
																					•
																					Use
																					a
																					mix
																					of
																					letters,
																					numbers,
																					and
																					symbols
																				</li>
																				<li>
																					•
																					Consider
																					using
																					a
																					password
																					manager
																				</li>
																			</ul>
																		</div>
																	</PopoverContent>
																</Popover>

																<button
																	type="button"
																	onClick={() =>
																		setShowPassword(
																			!showPassword,
																		)
																	}
																	className="text-primary"
																>
																	{showPassword ? (
																		<EyeOffIcon className="h-4 w-4" />
																	) : (
																		<EyeIcon className="h-4 w-4" />
																	)}
																</button>
															</div>
														</div>

														{/* Strength Indicator */}
														{field.value && (
															<div className="flex items-center gap-2">
																<div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
																	<div
																		className="h-full transition-all duration-300"
																		style={{
																			width: `${(strength.score / 4) * 100}%`,
																			backgroundColor: `hsl(var(--${strength.color}-500) / 0.8)`,
																		}}
																	/>
																</div>
																<span className="text-xs text-muted-foreground min-w-[60px]">
																	{
																		strength.label
																	}
																</span>
															</div>
														)}
													</div>
												</FormControl>
											</FormItem>
										);
									}}
								/>
							)}
						</div>
					</div>

					<Button type="submit" loading={form.formState.isSubmitting}>
						{t("onboarding.continue")}
						<ArrowRightIcon className="ml-2 size-4" />
					</Button>
				</form>
			</Form>
		</div>
	);
}
