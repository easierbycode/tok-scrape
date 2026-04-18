/**
 * Runtime-toggleable feature flags for development testing
 * Uses localStorage (client) + cookies (server) for persistence
 *
 * Changes take effect immediately without server restart
 */

export const DEV_FLAGS = {
	devAdminBypass: {
		key: "devAdminBypass",
		description: "Skip admin role check in development",
		defaultValue: false,
	},
	useRealStripe: {
		key: "useRealStripe",
		description: "Call real Stripe API (vs mock)",
		defaultValue: true,
	},
	sendRealEmails: {
		key: "sendRealEmails",
		description: "Send actual emails (vs console log)",
		defaultValue: true,
	},
	auditLog: {
		key: "auditLog",
		description: "Enable audit logging to database",
		defaultValue: true,
	},
} as const;

export type DevFlagKey = keyof typeof DEV_FLAGS;

/**
 * Get flag value from localStorage (client-side only)
 * @param flag - Flag key
 * @returns Flag value (boolean)
 */
export function getDevFlag(flag: DevFlagKey): boolean {
	if (typeof window === "undefined") {
		// Server-side: use getDevFlagFromRequest() instead
		return DEV_FLAGS[flag].defaultValue;
	}

	// Client-side: check localStorage
	const stored = localStorage.getItem(`devFlag_${flag}`);
	if (stored !== null) {
		return stored === "true";
	}

	return DEV_FLAGS[flag].defaultValue;
}

/**
 * Set flag value (client-side only)
 * Also sets cookie for server-side reading
 * @param flag - Flag key
 * @param value - Flag value
 */
export function setDevFlag(flag: DevFlagKey, value: boolean): void {
	if (typeof window === "undefined") {
		return;
	}

	localStorage.setItem(`devFlag_${flag}`, String(value));

	// Also set cookie for server-side reading
	const maxAge = 86400; // 24 hours
	document.cookie = `devFlag_${flag}=${value}; path=/; max-age=${maxAge}`;
}

/**
 * Get flag from request cookies (server-side)
 * @param flag - Flag key
 * @param cookieHeader - Cookie header string from request
 * @returns Flag value (boolean)
 */
export function getDevFlagFromRequest(
	flag: DevFlagKey,
	cookieHeader: string,
): boolean {
	if (!cookieHeader) {
		return DEV_FLAGS[flag].defaultValue;
	}

	const cookies = Object.fromEntries(
		cookieHeader.split("; ").map((c) => {
			const [key, ...valueParts] = c.split("=");
			return [key, valueParts.join("=")]; // Handle values with = in them
		}),
	);

	const stored = cookies[`devFlag_${flag}`];
	if (stored !== undefined) {
		return stored === "true";
	}

	return DEV_FLAGS[flag].defaultValue;
}
