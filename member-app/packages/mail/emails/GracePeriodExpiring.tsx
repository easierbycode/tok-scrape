import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function GracePeriodExpiring({
	name,
	daysRemaining,
	updatePaymentUrl,
	locale,
	translations,
}: {
	name: string;
	daysRemaining: number;
	updatePaymentUrl: string;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626" }}>
				{daysRemaining === 1
					? "Final Reminder: Grace Period Ends Tomorrow"
					: `Reminder: ${daysRemaining} Days Left in Grace Period`}
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				This is a friendly reminder that your grace period is ending soon. You
				have {daysRemaining} {daysRemaining === 1 ? "day" : "days"} remaining
				to update your payment method.
			</Text>

			<Text style={{ fontWeight: "bold", color: "#dc2626" }}>
				If payment is not received, you will lose access to:
			</Text>

			<ul style={{ paddingLeft: "20px" }}>
				<li>LifePreneur Discord community</li>
				<li>Daily live training sessions</li>
				<li>All premium resources and tools</li>
			</ul>

			<PrimaryButton href={updatePaymentUrl}>
				Update Payment Now &rarr;
			</PrimaryButton>

			<Text style={{ fontSize: "14px", color: "#6b7280" }}>
				Questions? Reply to this email or visit our support page.
			</Text>
		</Wrapper>
	);
}

GracePeriodExpiring.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	daysRemaining: 2,
	updatePaymentUrl: "https://app.example.com/settings/billing",
};

export default GracePeriodExpiring;

