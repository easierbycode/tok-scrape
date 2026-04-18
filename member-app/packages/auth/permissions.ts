import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

const statement = {
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/**
 * Owner role: full admin permissions including impersonation.
 * Only the owner (super admin) can impersonate users.
 */
export const ownerRole = ac.newRole({
	...adminAc.statements,
});

/**
 * Admin role: full admin permissions excluding impersonation.
 * Regular admins can manage users but cannot impersonate them.
 */
export const adminRole = ac.newRole({
	user: ["create", "list", "set-role", "ban", "delete", "set-password"],
	session: ["list", "revoke", "delete"],
});
