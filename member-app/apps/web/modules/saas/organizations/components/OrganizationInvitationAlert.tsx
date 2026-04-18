import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { useTranslations } from "next-intl";
import { MailCheckIcon } from "@/modules/ui/icons";

export function OrganizationInvitationAlert({
	className,
}: {
	className?: string;
}) {
	const t = useTranslations();
	return (
		<Alert variant="primary" className={className}>
			<MailCheckIcon />
			<AlertTitle>{t("organizations.invitationAlert.title")}</AlertTitle>
			<AlertDescription>
				{t("organizations.invitationAlert.description")}
			</AlertDescription>
		</Alert>
	);
}
