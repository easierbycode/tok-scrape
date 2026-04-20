import crypto from "node:crypto";

/**
 * CSRF Protection Utilities
 * Implements double-submit cookie pattern (OWASP recommended)
 *
 * Pattern:
 * - HttpOnly cookie (csrf-token): Backend validates, not accessible to JS
 * - Readable cookie (csrf-token-read): Frontend sends in header, accessible to JS
 * - Both cookies contain the same token value
 * - Frontend reads readable cookie and sends in x-csrf-token header
 * - Backend validates header token matches HttpOnly cookie token
 */

/**
 * Generate a cryptographically secure random CSRF token
 * @returns 32-byte random hex string (64 characters)
 */
export function generateCSRFToken(): string {
	return crypto.randomBytes(32).toString("hex");
}

// Note: setCSRFCookies() has been removed.
// CSRF cookies are now set directly in auth.ts using ctx.setCookie()
// which properly appends multiple Set-Cookie headers.

/**
 * Parse cookie header string into object
 * @param cookieString - Cookie header value (e.g., "key1=value1; key2=value2")
 * @returns Object with cookie key-value pairs
 */
export function parseCookies(cookieString: string): Record<string, string> {
	if (!cookieString) {
		return {};
	}

	return Object.fromEntries(
		cookieString
			.split("; ")
			.map((cookie) => {
				const [key, ...valueParts] = cookie.split("=");
				return [key, valueParts.join("=")]; // Handle values with = in them
			})
			.filter(([key]) => key), // Filter out empty keys
	);
}

/**
 * Validate CSRF token using constant-time comparison
 * Prevents timing attacks by comparing tokens in constant time
 *
 * @param cookieString - Cookie header string from request
 * @param headerToken - CSRF token from x-csrf-token header
 * @returns true if tokens match, false otherwise
 */
export function validateCSRFToken(
	cookieString: string,
	headerToken: string,
): boolean {
	const cookies = parseCookies(cookieString);
	const cookieToken = cookies["csrf-token"];

	// Both tokens must be present
	if (!cookieToken || !headerToken) {
		return false;
	}

	// Tokens must be same length for constant-time comparison
	if (cookieToken.length !== headerToken.length) {
		return false;
	}

	// Constant-time comparison (prevents timing attacks)
	try {
		return crypto.timingSafeEqual(
			Buffer.from(cookieToken),
			Buffer.from(headerToken),
		);
	} catch {
		// If buffer creation fails, tokens don't match
		return false;
	}
}
