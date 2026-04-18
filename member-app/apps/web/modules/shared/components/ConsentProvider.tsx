"use client";

import Cookies from "js-cookie";
import { createContext, useEffect, useState } from "react";

export const ConsentContext = createContext<{
	userHasConsented: boolean | null;
	allowCookies: () => void;
	declineCookies: () => void;
}>({
	userHasConsented: null,
	allowCookies: () => {},
	declineCookies: () => {},
});

export function ConsentProvider({
	children,
	initialConsent,
}: {
	children: React.ReactNode;
	initialConsent?: boolean;
}) {
	// Use null to indicate "not set yet", true/false for explicit choice
	const [userHasConsented, setUserHasConsented] = useState<boolean | null>(
		initialConsent !== undefined ? initialConsent : null,
	);

	// Sync with cookie on mount (for client-side hydration)
	useEffect(() => {
		const consentCookie = Cookies.get("consent");
		if (consentCookie !== undefined) {
			setUserHasConsented(consentCookie === "true");
		}
	}, []);

	const allowCookies = () => {
		Cookies.set("consent", "true", { expires: 30 });
		setUserHasConsented(true);
	};

	const declineCookies = () => {
		Cookies.set("consent", "false", { expires: 30 });
		setUserHasConsented(false);
	};

	return (
		<ConsentContext.Provider
			value={{ userHasConsented, allowCookies, declineCookies }}
		>
			{children}
		</ConsentContext.Provider>
	);
}
