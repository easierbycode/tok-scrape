import {
	adminClient,
	inferAdditionalFields,
	magicLinkClient,
	passkeyClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from ".";
import { ac, adminRole, ownerRole } from "./permissions";

export const authClient = createAuthClient({
	baseURL: typeof window !== "undefined" ? window.location.origin : "",
	plugins: [
		inferAdditionalFields<typeof auth>(),
		magicLinkClient(),
		adminClient({
			ac,
			roles: {
				owner: ownerRole,
				admin: adminRole,
			},
		}),
		passkeyClient(),
		twoFactorClient(),
	],
});

export type AuthClientErrorCodes = typeof authClient.$ERROR_CODES & {
	INVALID_INVITATION: string;
};
