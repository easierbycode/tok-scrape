/**
 * Application roles stored on `User.role` (string).
 * Keep in sync with assign-role schema and admin UI.
 */
export const ROLES = {
	OWNER: "owner",
	ANALYTICS_VIEWER: "analytics_viewer",
	ADMIN: "admin",
	SUPPORT: "support",
	USER: "user",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ASSIGNABLE_APP_ROLES = [
	ROLES.OWNER,
	ROLES.ANALYTICS_VIEWER,
	ROLES.ADMIN,
	ROLES.SUPPORT,
	ROLES.USER,
] as const satisfies readonly AppRole[];

/** Roles that may call `adminProcedure` (full admin API + dashboard). */
export function canUseAdminProcedure(role: string | null | undefined): boolean {
	return role === ROLES.OWNER || role === ROLES.ADMIN;
}

/** Roles that may call analytics-only procedures (and view `/admin/analytics`). */
export function canUseAnalyticsProcedure(
	role: string | null | undefined,
	isSuperAdmin: boolean,
): boolean {
	if (isSuperAdmin) {
		return true;
	}
	return (
		role === ROLES.OWNER ||
		role === ROLES.ADMIN ||
		role === ROLES.ANALYTICS_VIEWER
	);
}

/** Command Center: owner accounts and configured super-admins only. */
export function canAccessCommandCenter(
	role: string | null | undefined,
	isSuperAdmin: boolean,
): boolean {
	if (isSuperAdmin) {
		return true;
	}
	return role === ROLES.OWNER;
}
