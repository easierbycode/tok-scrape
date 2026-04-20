import { z } from "zod";

export const contactFormSchema = z.object({
	email: z.string().email(),
	name: z.string().min(3),
	message: z.string().min(10),
	/** Honeypot — must stay empty; bots often fill this field. */
	website: z.string().optional(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
