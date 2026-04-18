// OrganizationMemberRole type removed with organization plugin
// TODO: Define type locally or import from another source if needed
type OrganizationMemberRole = "owner" | "admin" | "member";

import { useTranslations } from "next-intl";

export function useOrganizationMemberRoles() {
	const t = useTranslations();

	return {
		member: t("organizations.roles.member"),
		owner: t("organizations.roles.owner"),
		admin: t("organizations.roles.admin"),
	} satisfies Record<OrganizationMemberRole, string>;
}
