import "server-only";
import { auth } from "@repo/auth";
import { getInvitationById } from "@repo/database";
import { orpcClient } from "@shared/lib/orpc-client";
import { headers } from "next/headers";
import { cache } from "react";

export const getSession = cache(async () => {
	const session = await auth.api.getSession({
		headers: await headers(),
		query: {
			disableCookieCache: true,
		},
	});

	return session;
});

export const getActiveOrganization = cache(
	async (
		_slug: string,
	): Promise<{
		id: string;
		name: string;
		slug: string;
		logo: string | null;
	} | null> => {
		// Organization plugin removed - getFullOrganization not available
		// TODO: Implement via ORPC or database query if needed
		try {
			// Return null for now since organization plugin is removed
			return null;
		} catch {
			return null;
		}
	},
);

export const getOrganizationList = cache(
	async (): Promise<
		Array<{ id: string; name: string; slug: string; logo: string | null }>
	> => {
		// Organization plugin removed - listOrganizations not available
		// TODO: Implement via ORPC or database query if needed
		try {
			// Return empty array for now since organization plugin is removed
			return [];
		} catch {
			return [];
		}
	},
);

export const getUserAccounts = cache(async () => {
	try {
		const userAccounts = await auth.api.listUserAccounts({
			headers: await headers(),
		});

		return userAccounts;
	} catch {
		return [];
	}
});

export const getUserPasskeys = cache(async () => {
	// Passkey API methods are client-side only (require browser APIs)
	// Server-side passkey listing not available via Better-Auth API
	// Return empty array - passkeys should be fetched client-side
	try {
		return [];
	} catch {
		return [];
	}
});

export const getInvitation = cache(async (id: string) => {
	try {
		return await getInvitationById(id);
	} catch {
		return null;
	}
});

// Cached per-request purchase fetch — deduplicated across all layout layers
// that need billing data (e.g. (saas)/layout and app/layout both call this).
export const getPurchases = cache(async () => {
	try {
		const result = await orpcClient.payments.listPurchases({});
		return result?.purchases ?? [];
	} catch {
		return [];
	}
});
