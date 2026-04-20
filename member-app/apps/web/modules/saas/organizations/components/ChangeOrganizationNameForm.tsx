"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	name: z.string().min(3),
});

type FormSchema = z.infer<typeof formSchema>;

export function ChangeOrganizationNameForm() {
	const t = useTranslations();
	const { activeOrganization } = useActiveOrganization();

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: activeOrganization?.name ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ name: _name }) => {
		if (!activeOrganization) {
			return;
		}

		try {
			// Organization plugin removed - update functionality disabled
			// TODO: Implement via ORPC if needed
			throw new Error(
				"Organization update is not available. Organization plugin has been removed.",
			);
		} catch {
			toast.error(
				t(
					"organizations.settings.notifications.organizationNameNotUpdated",
				),
			);
		}
	});

	return (
		<SettingsItem title={t("organizations.settings.changeName.title")}>
			<form onSubmit={onSubmit}>
				<Input {...form.register("name")} />

				<div className="mt-4 flex justify-end">
					<Button
						type="submit"
						disabled={
							!(
								form.formState.isValid &&
								form.formState.dirtyFields.name
							)
						}
						loading={form.formState.isSubmitting}
					>
						{t("settings.save")}
					</Button>
				</div>
			</form>
		</SettingsItem>
	);
}
