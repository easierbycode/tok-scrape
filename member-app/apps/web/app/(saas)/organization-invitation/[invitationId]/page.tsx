import { getOrganizationById } from "@repo/database";
import { getInvitation } from "@saas/auth/lib/server";
import { OrganizationInvitationModal } from "@saas/organizations/components/OrganizationInvitationModal";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { redirect } from "next/navigation";

export default async function OrganizationInvitationPage({
	params,
}: {
	params: Promise<{ invitationId: string }>;
}) {
	const { invitationId } = await params;

	const invitation = await getInvitation(invitationId);

	if (!invitation) {
		redirect("/app");
	}

	const organization = invitation
		? await getOrganizationById(invitation.organizationId)
		: null;

	if (!invitation || !organization) {
		redirect("/app");
	}

	return (
		<AuthWrapper>
			<OrganizationInvitationModal
				organizationName={invitation.organization.name}
				organizationSlug={invitation.organization.slug || ""}
				logoUrl={organization?.logo || undefined}
				invitationId={invitationId}
			/>
		</AuthWrapper>
	);
}
