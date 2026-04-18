/** Human-readable labels for `User.role` values shown in admin UI. */
export function formatAppRoleLabel(role: string | null | undefined): string {
	if (!role || role === "user") {
		return "Standard user";
	}

	const labels: Record<string, string> = {
		owner: "Owner",
		admin: "Administrator",
		analytics_viewer: "Analytics viewer",
		support: "Support",
	};

	return labels[role] ?? role;
}

export function shortAppRoleLabel(role: string | null | undefined): string {
	if (!role || role === "user") {
		return "";
	}

	const labels: Record<string, string> = {
		owner: "Owner",
		admin: "Admin",
		analytics_viewer: "Analytics",
		support: "Support",
	};

	return labels[role] ?? role;
}

export function isElevatedAppRole(role: string | null | undefined): boolean {
	if (!role || role === "user") {
		return false;
	}
	return true;
}
