import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function PurchaseConfirmation({
	name,
	planName,
	amount,
	receiptUrl,
	locale,
	translations,
}: {
	name: string;
	planName: string;
	amount: number;
	receiptUrl: string;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedAmount = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold" }}>
				Welcome to LifePreneur!
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				Thank you for subscribing to LifePreneur! We're excited to have
				you join our community of entrepreneurs and creators.
			</Text>

			<Text style={{ fontWeight: "bold" }}>
				Your Subscription Details:
			</Text>
			<Text>
				Plan: {planName}
				<br />
				Amount: {formattedAmount}
			</Text>

			<Text>You now have access to:</Text>
			<Text>
				• Private Discord community
				<br />• Premium resources and tools
				<br />• Direct support from our team
			</Text>

			<PrimaryButton href={receiptUrl}>View Receipt &rarr;</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				If you have any questions, our support team is here to help.
				Welcome aboard!
			</Text>

			<Text className="text-muted-foreground text-sm">
				If the button above doesn't work, copy and paste this link into
				your browser:
				<br />
				<Link href={receiptUrl}>{receiptUrl}</Link>
			</Text>
		</Wrapper>
	);
}

PurchaseConfirmation.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	planName: "Creator Monthly",
	amount: 9900, // $99.00 in cents
	receiptUrl: "#",
};

export default PurchaseConfirmation;
