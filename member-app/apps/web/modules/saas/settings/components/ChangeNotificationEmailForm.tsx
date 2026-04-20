"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	notificationEmail: z.string().email().or(z.literal("")),
});

type FormSchema = z.infer<typeof formSchema>;

export function ChangeNotificationEmailForm() {
	const { user, reloadSession } = useSession();
	const t = useTranslations();

	const form = useForm<FormSchema>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			notificationEmail: user?.notificationEmail ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async ({ notificationEmail }) => {
		try {
			await orpcClient.users.updateNotificationEmail({
				notificationEmail,
			});

			toast.success(
				t("settings.account.notificationEmail.notifications.success"),
			);

			reloadSession();
		} catch {
			toast.error(
				t("settings.account.notificationEmail.notifications.error"),
			);
		}
	});

	return (
		<SettingsItem
			title={t("settings.account.notificationEmail.title")}
			description={t("settings.account.notificationEmail.description")}
		>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSubmit();
				}}
			>
				<Input
					type="email"
					placeholder={user?.email ?? ""}
					{...form.register("notificationEmail")}
				/>

				<div className="mt-4 flex justify-end">
					<Button
						type="submit"
						loading={form.formState.isSubmitting}
						disabled={!form.formState.isDirty}
					>
						{t("settings.save")}
					</Button>
				</div>
			</form>
		</SettingsItem>
	);
}
