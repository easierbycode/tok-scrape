import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function DiscordInvite({
	recipientName,
	primaryUserName,
	discordInviteUrl,
	expiresAt,
	locale,
	translations,
}: {
	recipientName: string;
	primaryUserName: string;
	discordInviteUrl: string;
	expiresAt: Date;
} & BaseMailProps) {
	const _t = createTranslator({
		locale,
		messages: translations,
	});

	const formattedDate = new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(expiresAt);

	return (
		<Wrapper>
			<Text style={{ fontSize: "18px", fontWeight: "bold" }}>
				You've Been Invited to Join LifePreneur Discord!
			</Text>

			<Text>Hi {recipientName},</Text>

			<Text>
				{primaryUserName} has invited you to join the LifePreneur community on
				Discord as part of their subscription.
			</Text>

			<Text>
				Click the button below to join our private community and get access to:
			</Text>

			<ul style={{ paddingLeft: "20px" }}>
				<li>Daily live training sessions</li>
				<li>Private community discussions</li>
				<li>Direct support from our team</li>
				<li>Exclusive resources and tools</li>
			</ul>

			<PrimaryButton href={discordInviteUrl}>
				Join Discord Server &rarr;
			</PrimaryButton>

			<Text style={{ fontSize: "14px", color: "#dc2626" }}>
				This invitation expires on {formattedDate}.
			</Text>

			<Text style={{ fontSize: "14px", color: "#6b7280" }}>
				If you have any questions, please contact our support team.
			</Text>
		</Wrapper>
	);
}

DiscordInvite.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	recipientName: "Jane Doe",
	primaryUserName: "John Doe",
	discordInviteUrl: "https://discord.gg/example",
	expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

export default DiscordInvite;

