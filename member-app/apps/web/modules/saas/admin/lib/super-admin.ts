import "server-only";

export function checkIsSuperAdmin(email: string): boolean {
	const superAdmins =
		process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
			e.trim().toLowerCase(),
		) || [];
	return superAdmins.includes(email.toLowerCase());
}
