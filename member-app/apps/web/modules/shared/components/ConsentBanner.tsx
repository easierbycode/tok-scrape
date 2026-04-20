"use client";

import { useCookieConsent } from "@shared/hooks/cookie-consent";
import { Button } from "@ui/components/button";
import { useEffect, useState } from "react";
import { CookieIcon } from "@/modules/ui/icons";

export function ConsentBanner() {
	const { userHasConsented, allowCookies, declineCookies } =
		useCookieConsent();
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	if (userHasConsented !== null) {
		return null;
	}

	return (
		<div className="fixed left-0 right-0 bottom-0 z-50 p-4">
			<div className="max-w-4xl mx-auto rounded-2xl border bg-card/95 backdrop-blur-sm p-6 text-card-foreground shadow-xl">
				<div className="flex gap-4">
					<CookieIcon className="block size-6 shrink-0 text-primary/60 mt-1" />
					<div className="flex-1">
						<p className="text-sm leading-relaxed mb-4">
							We use essential cookies for authentication,
							security, and affiliate attribution (to fairly
							compensate creators who refer you). We also use
							optional analytics cookies to improve your
							experience.
						</p>
						<div className="flex gap-3 flex-wrap">
							<Button
								variant="outline"
								onClick={() => declineCookies()}
								className="border-[rgba(91,91,98,0.5)] text-[rgba(91,91,98,1)] shadow-[0px_4px_12px_0px_rgba(0,0,0,0.15)]"
							>
								Essential Only
							</Button>
							<Button onClick={() => allowCookies()}>
								Accept All
							</Button>
							<Button variant="ghost" size="sm" asChild>
								<a href="/legal/cookies">Learn More</a>
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
