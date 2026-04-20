"use client";

import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { useRouter } from "next/navigation";
import { AlertCircle, Home } from "@/modules/ui/icons";

interface AuthErrorDisplayProps {
	error: {
		code?: string;
		message: string;
	};
}

export function AuthErrorDisplay({ error }: AuthErrorDisplayProps) {
	const router = useRouter();

	const isDatabaseError =
		error.message.toLowerCase().includes("database") ||
		error.message.toLowerCase().includes("connection");

	if (isDatabaseError) {
		return (
			<Alert variant="error" className="max-w-md">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Unable to sign in right now</AlertTitle>
				<AlertDescription className="mt-2 space-y-2">
					<p>
						We're experiencing temporary technical issues. Please
						try again in a few minutes.
					</p>
					<p className="text-xs">
						Still having trouble? Email support@lifepreneur.com
					</p>
				</AlertDescription>
				<div className="mt-4 flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => router.refresh()}
					>
						Try Again
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => router.push("/")}
					>
						<Home className="mr-2 h-4 w-4" />
						Go Home
					</Button>
				</div>
			</Alert>
		);
	}

	return (
		<Alert variant="error" className="max-w-md">
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>Sign in failed</AlertTitle>
			<AlertDescription>{error.message}</AlertDescription>
		</Alert>
	);
}
