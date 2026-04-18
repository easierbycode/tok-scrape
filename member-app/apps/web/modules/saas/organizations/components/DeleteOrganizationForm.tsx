"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function DeleteOrganizationForm() {
	const t = useTranslations();
	const { confirm } = useConfirmationAlert();
	const { activeOrganization } = useActiveOrganization();

	if (!activeOrganization) {
		return null;
	}

	const handleDelete = async () => {
		confirm({
			title: t("organizations.settings.deleteOrganization.title"),
			message: t(
				"organizations.settings.deleteOrganization.confirmation",
			),
			destructive: true,
			onConfirm: async () => {
				// Organization plugin removed - delete functionality disabled
				// TODO: Implement via ORPC if needed
				toast.error(
					t(
						"organizations.settings.notifications.organizationNotDeleted",
					),
				);
				throw new Error(
					"Organization deletion is not available. Organization plugin has been removed.",
				);
			},
		});
	};

	return (
		<SettingsItem
			danger
			title={t("organizations.settings.deleteOrganization.title")}
			description={t(
				"organizations.settings.deleteOrganization.description",
			)}
		>
			<div className="mt-4 flex justify-end">
				<Button variant="error" onClick={handleDelete}>
					{t("organizations.settings.deleteOrganization.submit")}
				</Button>
			</div>
		</SettingsItem>
	);
}
