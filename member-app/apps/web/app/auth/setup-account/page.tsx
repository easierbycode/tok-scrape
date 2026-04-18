"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { orpcClient } from "@shared/lib/orpc-client";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	AlertTriangleIcon,
	EyeIcon,
	EyeOffIcon,
	Loader2,
} from "@/modules/ui/icons";

const schema = z
	.object({
		password: z.string().min(8, "Password must be at least 8 characters"),
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

type FormValues = z.infer<typeof schema>;

export default function SetupAccountPage() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const token = searchParams.get("token");

	const [email, setEmail] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(true);
	const [error, setError] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			password: "",
			confirmPassword: "",
		},
	});

	// Verify the token on mount and extract email
	useEffect(() => {
		if (!token) {
			setError("Invalid setup link. Please request a new one.");
			setIsVerifying(false);
			return;
		}

		// Validate token and get email without consuming it
		orpcClient.users
			.validateSetupToken({ token })
			.then((data) => {
				setEmail(data.email);
				setIsVerifying(false);
			})
			.catch((e) => {
				setError(
					e instanceof Error
						? e.message
						: "Invalid or expired setup link. Please contact support for a new invitation.",
				);
				setIsVerifying(false);
			});
	}, [token]);

	const onSubmit = async ({ password }: FormValues) => {
		if (!email) {
			setError("No email found. Please request a new setup link.");
			return;
		}

		if (!token) {
			setError("Invalid setup link. Please request a new one.");
			return;
		}

		try {
			// Call the setup account API endpoint
			await orpcClient.users.setupAccount({
				email,
				password,
				token,
			});

			// Sign in the user automatically
			const { error: signInError } = await authClient.signIn.email({
				email,
				password,
			});

			if (signInError) {
				throw signInError;
			}

			// Redirect to app
			router.push(config.auth.redirectAfterSignIn);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: "Failed to set up account. Please try again.",
			);
		}
	};

	if (!token) {
		return (
			<div className="space-y-4">
				<Alert variant="error">
					<AlertTriangleIcon className="h-4 w-4" />
					<AlertDescription>
						Invalid setup link. Please contact support for a new
						invitation.
					</AlertDescription>
				</Alert>
				<Button
					variant="outline"
					className="w-full"
					onClick={() => router.push("/auth/login")}
				>
					Go to Login
				</Button>
			</div>
		);
	}

	if (isVerifying) {
		return (
			<div className="flex items-center justify-center py-8 gap-2">
				<Loader2 className="h-6 w-6 animate-spin" />
				<p>Verifying your link...</p>
			</div>
		);
	}

	if (error && !email) {
		return (
			<div className="space-y-4">
				<Alert variant="error">
					<AlertTriangleIcon className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
				<Button
					variant="outline"
					className="w-full"
					onClick={() => router.push("/auth/login")}
				>
					Go to Login
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="space-y-2 text-center">
				<h1 className="font-serif text-3xl font-bold tracking-tight">
					Set Up Your Account
				</h1>
				<p className="text-muted-foreground">
					Create a password for {email}
				</p>
			</div>

			{error && (
				<Alert variant="error">
					<AlertTriangleIcon className="h-4 w-4" />
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="space-y-4"
				>
					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Password</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={
												showPassword
													? "text"
													: "password"
											}
											placeholder="Enter your password"
											className="pr-10"
											autoComplete="new-password"
											{...field}
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(!showPassword)
											}
											className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary text-xl"
										>
											{showPassword ? (
												<EyeOffIcon className="size-4" />
											) : (
												<EyeIcon className="size-4" />
											)}
										</button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="confirmPassword"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Confirm Password</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											type={
												showConfirmPassword
													? "text"
													: "password"
											}
											placeholder="Confirm your password"
											className="pr-10"
											autoComplete="new-password"
											{...field}
										/>
										<button
											type="button"
											onClick={() =>
												setShowConfirmPassword(
													!showConfirmPassword,
												)
											}
											className="absolute inset-y-0 right-0 flex items-center pr-4 text-primary text-xl"
										>
											{showConfirmPassword ? (
												<EyeOffIcon className="size-4" />
											) : (
												<EyeIcon className="size-4" />
											)}
										</button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<Button
						type="submit"
						className="w-full"
						disabled={form.formState.isSubmitting}
					>
						{form.formState.isSubmitting ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Setting up...
							</>
						) : (
							"Set Up Account"
						)}
					</Button>
				</form>
			</Form>
		</div>
	);
}
