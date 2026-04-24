import { config } from "@repo/config";
import { Resend } from "resend";
import type { SendEmailHandler } from "../../types";

const { from } = config.mails;

export const send: SendEmailHandler | Record<string, never> = process.env.RESEND_API_KEY
	? (() => {
		const resend = new Resend(process.env.RESEND_API_KEY);
		return async ({ to, subject, html, text }) => {
			await resend.emails.send({
				from,
				to: [to],
				subject,
				html,
				text,
			});
		};
	})()
	: {};