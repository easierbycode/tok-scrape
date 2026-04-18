// ActiveOrganization type removed with organization plugin
type ActiveOrganization = {
	id: string;
	name: string;
	slug: string;
	logo: string | null;
	members?: Array<{ userId: string; role: string }>;
	invitations?: Array<{
		id: string;
		email: string;
		role: string;
		status: string;
		createdAt: Date;
		expiresAt: Date;
	}>;
};

export function isOrganizationAdmin(
	organization?: ActiveOrganization | null,
	user?: {
		id: string;
		role?: string | null;
	} | null,
) {
	const userOrganizationRole = organization?.members?.find(
		(member) => member.userId === user?.id,
	)?.role;

	return (
		["owner", "admin"].includes(userOrganizationRole ?? "") ||
		user?.role === "admin" ||
		user?.role === "owner"
	);
}
