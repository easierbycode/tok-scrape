import { db } from "@repo/database";
import { sendEmail } from "@repo/mail";
import { getBaseUrl } from "@repo/utils";
import { nanoid } from "nanoid";

interface SendSetupAccountEmailInput {
	email: string;
	name: string | null;
}

/**
 * Creates a fresh 24h setup token and sends the setup-account email.
 * Removes existing verification rows for this email so old links stop working.
 */
export async function sendSetupAccountEmail({
	email,
	name,
}: SendSetupAccountEmailInput): Promise<void> {
	await db.verification.deleteMany({
		where: { identifier: email },
	});

	const token = nanoid(32);
	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

	await db.verification.create({
		data: {
			identifier: email,
			value: token,
			expiresAt,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	const baseUrl = getBaseUrl();
	const setupUrl = `${baseUrl}/auth/setup-account?token=${token}`;

	await sendEmail({
		to: email,
		templateId: "setupAccount",
		context: {
			url: setupUrl,
			name: name ?? email,
		},
		locale: "en",
	});
}
