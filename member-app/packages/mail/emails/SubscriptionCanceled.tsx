import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function SubscriptionCanceled({
	name,
	cancelledAt,
	reactivateUrl,
	locale,
	translations,
}: {
	name: string;
	cancelledAt: Date;
	reactivateUrl: string;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedDate = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(cancelledAt);

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold" }}>
				Subscription Canceled
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				Your LifePreneur subscription was canceled on {formattedDate}.
				We're sorry to see you go!
			</Text>

			<Text>
				Your access will remain active until the end of your current
				billing period. After that, you'll lose access to all premium
				features and content.
			</Text>

			<Text>
				If you changed your mind or this was a mistake, you can
				reactivate your subscription anytime before your access expires.
			</Text>

			<PrimaryButton href={reactivateUrl}>
				Reactivate Subscription &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				Thank you for being part of the LifePreneur community. We hope
				to see you again soon!
			</Text>

			<Text className="text-muted-foreground text-sm">
				If the button above doesn't work, copy and paste this link into
				your browser:
				<br />
				<Link href={reactivateUrl}>{reactivateUrl}</Link>
			</Text>
		</Wrapper>
	);
}

SubscriptionCanceled.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	cancelledAt: new Date(),
	reactivateUrl: "#",
};

export default SubscriptionCanceled;
