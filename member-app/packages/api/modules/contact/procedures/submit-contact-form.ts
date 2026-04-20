import { ORPCError } from "@orpc/client";
import { config } from "@repo/config";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { rateLimitMiddleware } from "../../../orpc/middleware/rate-limit-middleware";
import { publicProcedure } from "../../../orpc/procedures";
import { contactFormSchema } from "../types";

export const submitContactForm = publicProcedure
	.route({
		method: "POST",
		path: "/contact",
		tags: ["Contact"],
		summary: "Submit contact form",
	})
	.input(contactFormSchema)
	.use(localeMiddleware)
	.use(rateLimitMiddleware({ limit: 3, windowMs: 60 * 60 * 1000 }))
	.handler(
		async ({ input: { email, name, message, website }, context: { locale } }) => {
			if (website?.trim()) {
				return;
			}

			try {
				await sendEmail({
					to: config.contactForm.to,
					locale,
					subject: config.contactForm.subject,
					text: `Name: ${name}\n\nEmail: ${email}\n\nMessage: ${message}`,
				});
			} catch (error) {
				logger.error(error);
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
