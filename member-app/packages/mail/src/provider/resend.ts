import { config } from "@repo/config";
import { Resend } from "resend";
import type { SendEmailHandler } from "../../types";

const { from } = config.mails;

const resendApiKey = process.env.RESEND_API_KEY;

export const send: SendEmailHandler | Record<string, never> = resendApiKey
	? (async ({ to, subject, html, text }) => {
		const resend = new Resend(resendApiKey);
		await resend.emails.send({
			from,
			to: [to],
			subject,
			html,
			text,
		});
	}) satisfies SendEmailHandler
	: {};