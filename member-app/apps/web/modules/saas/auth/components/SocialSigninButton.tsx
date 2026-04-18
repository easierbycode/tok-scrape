"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { Button } from "@ui/components/button";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { Loader2 } from "@/modules/ui/icons";
import { oAuthProviders } from "../constants/oauth-providers";

export function SocialSigninButton({
	provider,
	className,
	disabled,
	onLoadingChange,
}: {
	provider: keyof typeof oAuthProviders;
	className?: string;
	disabled?: boolean;
	onLoadingChange?: (loading: boolean) => void;
}) {
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const [isLoading, setIsLoading] = useState(false);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.auth.redirectAfterSignIn;

	const onSignin = () => {
		setIsLoading(true);
		onLoadingChange?.(true);
		const callbackURL = new URL(redirectPath, window.location.origin);
		authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
	};

	return (
		<Button
			onClick={() => onSignin()}
			variant="light"
			type="button"
			className={className}
			disabled={disabled || isLoading}
		>
			{isLoading ? (
				<>
					<Loader2 className="mr-2 size-4 animate-spin text-primary" />
					Connecting...
				</>
			) : (
				<>
					{providerData.icon && (
						<i className="mr-2 text-primary">
							<providerData.icon className="size-4" />
						</i>
					)}
					{providerData.name}
				</>
			)}
		</Button>
	);
}
