import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function SubscriptionReactivated({
	name,
	planName,
	nextBillingDate,
	locale,
	translations,
}: {
	name: string;
	planName: string;
	nextBillingDate: Date;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedDate = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(nextBillingDate);

	const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
		? `${process.env.NEXT_PUBLIC_APP_URL}/app`
		: "#";

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold" }}>
				Welcome Back!
			</Text>

			<Text>Hi {name},</Text>

			<Text>
				Great news! Your LifePreneur subscription has been reactivated,
				and your access has been fully restored.
			</Text>

			<Text style={{ fontWeight: "bold" }}>Your Subscription:</Text>
			<Text>
				Plan: {planName}
				<br />
				Next billing date: {formattedDate}
			</Text>

			<Text>
				You now have full access to all premium features, including:
			</Text>
			<Text>
				• Private Discord community
				<br />• Premium resources and tools
				<br />• Direct support from our team
			</Text>

			<PrimaryButton href={dashboardUrl}>
				Access Dashboard &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				Thank you for coming back! We're thrilled to have you as part of
				the LifePreneur community again.
			</Text>

			<Text className="text-muted-foreground text-sm">
				If the button above doesn't work, copy and paste this link into
				your browser:
				<br />
				<Link href={dashboardUrl}>{dashboardUrl}</Link>
			</Text>
		</Wrapper>
	);
}

SubscriptionReactivated.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	name: "John Doe",
	planName: "Creator Monthly",
	nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

export default SubscriptionReactivated;
