import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function PaymentFailed({
	name,
	gracePeriodEndDate,
	updatePaymentUrl,
	supportUrl,
	locale,
	translations,
}: {
	name: string;
	gracePeriodEndDate: Date;
	updatePaymentUrl: string;
	supportUrl: string;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedDate = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(gracePeriodEndDate);

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
				Payment Failed - Action Required
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				We were unable to process your recent payment for your LifePreneur
				subscription. Don't worry - you still have access!
			</Text>

			<Text style={{ fontWeight: "bold" }}>
				You have until {formattedDate} to update your payment method.
			</Text>

			<Text>
				During this 7-day grace period, you'll have limited access to Discord
				(Support Only channels). Update your payment method now to restore full
				access immediately.
			</Text>

			<PrimaryButton href={updatePaymentUrl}>
				Update Payment Method &rarr;
			</PrimaryButton>

			<Text style={{ fontSize: "14px", color: "#6b7280" }}>
				Need help? Visit our <Link href={supportUrl}>support page</Link> or reply
				to this email.
			</Text>
		</Wrapper>
	);
}

PaymentFailed.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	gracePeriodEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	updatePaymentUrl: "https://app.example.com/settings/billing",
	supportUrl: "https://app.example.com/support",
};

export default PaymentFailed;

