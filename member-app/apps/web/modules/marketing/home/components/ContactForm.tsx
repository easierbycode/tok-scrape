"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ContactFormValues,
	contactFormSchema,
} from "@repo/api/modules/contact/types";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Alert, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import { Textarea } from "@ui/components/textarea";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { MailCheckIcon, MailIcon } from "@/modules/ui/icons";

export function ContactForm() {
	const t = useTranslations();
	const contactFormMutation = useMutation(
		orpc.contact.submit.mutationOptions(),
	);

	const form = useForm<ContactFormValues>({
		resolver: zodResolver(contactFormSchema),
		defaultValues: {
			name: "",
			email: "",
			message: "",
			website: "",
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await contactFormMutation.mutateAsync(values);
		} catch {
			form.setError("root", {
				message: t("contact.form.notifications.error"),
			});
		}
	});

	return (
		<div>
			{form.formState.isSubmitSuccessful ? (
				<Alert variant="success">
					<MailCheckIcon />
					<AlertTitle>
						{t("contact.form.notifications.success")}
					</AlertTitle>
				</Alert>
			) : (
				<Form {...form}>
					<form
						onSubmit={onSubmit}
						className="relative flex flex-col items-stretch gap-4"
					>
						{form.formState.errors.root?.message && (
							<Alert variant="error">
								<MailIcon />
								<AlertTitle>
									{form.formState.errors.root.message}
								</AlertTitle>
							</Alert>
						)}

						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("contact.form.name")}
									</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("contact.form.email")}
									</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="message"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("contact.form.message")}
									</FormLabel>
									<FormControl>
										<Textarea {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<input
							type="text"
							tabIndex={-1}
							autoComplete="off"
							aria-hidden="true"
							{...form.register("website")}
							style={{
								position: "absolute",
								opacity: 0,
								height: 0,
								width: 0,
								pointerEvents: "none",
							}}
						/>

						<Button
							type="submit"
							className="w-full"
							loading={form.formState.isSubmitting}
						>
							{t("contact.form.submit")}
						</Button>
					</form>
				</Form>
			)}
		</div>
	);
}
