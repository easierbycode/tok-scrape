import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function GracePeriod({
	name,
	expiresAt,
	updatePaymentUrl,
	locale,
	translations,
}: {
	name: string;
	expiresAt: Date;
	updatePaymentUrl: string;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedDate = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(expiresAt);

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold" }}>
				Payment Failed - Action Required
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				We were unable to process your recent payment for your
				LifePreneur subscription. Your account has been placed in a
				7-day grace period.
			</Text>

			<Text style={{ fontWeight: "bold" }}>
				Your access will expire on {formattedDate}.
			</Text>

			<Text>
				To continue enjoying all LifePreneur benefits, please update
				your payment method as soon as possible. Once updated, your
				subscription will automatically resume.
			</Text>

			<PrimaryButton href={updatePaymentUrl}>
				Update Payment Method &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				If you have any questions or need assistance, please contact our
				support team.
			</Text>

			<Text className="text-muted-foreground text-sm">
				If the button above doesn't work, copy and paste this link into
				your browser:
				<br />
				<Link href={updatePaymentUrl}>{updatePaymentUrl}</Link>
			</Text>
		</Wrapper>
	);
}

GracePeriod.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	updatePaymentUrl: "#",
};

export default GracePeriod;
