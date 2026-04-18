"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { OrganizationRoleSelect } from "@saas/organizations/components/OrganizationRoleSelect";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import type { SubmitHandler } from "react-hook-form";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
	role: z.enum(["member", "owner", "admin"]),
});

type FormValues = z.infer<typeof formSchema>;

export function InviteMemberForm({
	organizationId: _organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			role: "member",
		},
	});

	const onSubmit: SubmitHandler<FormValues> = async (_values) => {
		try {
			// Organization plugin removed - inviteMember functionality disabled
			// TODO: Implement via ORPC if needed
			throw new Error(
				"Organization member invitation is not available. Organization plugin has been removed.",
			);
		} catch {
			toast.error(
				t(
					"organizations.settings.members.inviteMember.notifications.error.title",
				),
			);
		}
	};

	return (
		<SettingsItem
			title={t("organizations.settings.members.inviteMember.title")}
			description={t(
				"organizations.settings.members.inviteMember.description",
			)}
		>
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="@container"
				>
					<div className="flex @md:flex-row flex-col gap-2">
						<div className="flex-1">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t(
												"organizations.settings.members.inviteMember.email",
											)}
										</FormLabel>
										<FormControl>
											<Input type="email" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>

						<div>
							<FormField
								control={form.control}
								name="role"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t(
												"organizations.settings.members.inviteMember.role",
											)}
										</FormLabel>
										<FormControl>
											<OrganizationRoleSelect
												value={field.value}
												onSelect={field.onChange}
											/>
										</FormControl>
									</FormItem>
								)}
							/>
						</div>
					</div>

					<div className="mt-4 flex justify-end">
						<Button
							type="submit"
							loading={form.formState.isSubmitting}
						>
							{t(
								"organizations.settings.members.inviteMember.submit",
							)}
						</Button>
					</div>
				</form>
			</Form>
		</SettingsItem>
	);
}
