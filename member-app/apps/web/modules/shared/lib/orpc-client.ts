import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ORPCError } from "@orpc/server";
import type { ApiRouterClient } from "@repo/api/orpc/router";
import { logger } from "@repo/logs";
import { getBaseUrl } from "@repo/utils";

/**
 * Helper function to get cookie value (client-side only)
 */
function getCookie(name: string): string | null {
	if (typeof window === "undefined") {
		return null;
	}
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) {
		return parts.pop()?.split(";").shift() || null;
	}
	return null;
}

const link = new RPCLink({
	url: `${getBaseUrl()}/api/rpc`,
	headers: async () => {
		const headers: Record<string, string> = {};

		if (typeof window !== "undefined") {
			// Client-side: Read CSRF token from readable cookie
			const csrfToken = getCookie("csrf-token-read");
			if (csrfToken) {
				headers["x-csrf-token"] = csrfToken;
			}
			return headers;
		}

		// Server-side: Get CSRF token from cookies
		const { cookies } = await import("next/headers");
		const cookieStore = await cookies();
		const csrfToken = cookieStore.get("csrf-token-read")?.value;
		if (csrfToken) {
			headers["x-csrf-token"] = csrfToken;
		}

		// Also include existing headers
		const { headers: nextHeaders } = await import("next/headers");
		const existingHeaders = Object.fromEntries(await nextHeaders());
		return { ...existingHeaders, ...headers };
	},
	interceptors: [
		onError((error) => {
			if (error instanceof Error && error.name === "AbortError") {
				return;
			}

			if (error instanceof ORPCError && error.code === "NOT_FOUND") {
				logger.info("ORPC client: resource not found", { error });
				return;
			}

			logger.error("ORPC client error", { error });
		}),
	],
});

export const orpcClient: ApiRouterClient = createORPCClient(link);
