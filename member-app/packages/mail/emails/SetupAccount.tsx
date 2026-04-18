import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../src/components/PrimaryButton";
import Wrapper from "../src/components/Wrapper";
import { defaultLocale, defaultTranslations } from "../src/util/translations";
import type { BaseMailProps } from "../types";

export function SetupAccount({
	url,
	name,
	locale,
	translations,
}: {
	url: string;
	name: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text className="text-xl font-semibold">
				Welcome to LifePreneur, {name}!
			</Text>

			<Text>{t("mail.setupAccount.body", { name })}</Text>

			<PrimaryButton href={url}>
				{t("mail.setupAccount.setUpAccount")} &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				{t("mail.common.openLinkInBrowser")}
				<br />
				<Link href={url} className="break-all">
					{url}
				</Link>
			</Text>

			<Text className="text-muted-foreground text-xs">
				This link will expire in 24 hours.
			</Text>
		</Wrapper>
	);
}

SetupAccount.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "https://lifepreneur.com/auth/setup-account?token=abc123",
	name: "John Doe",
};

export default SetupAccount;

