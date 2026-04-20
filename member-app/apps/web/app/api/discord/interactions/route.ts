import { DISCORD_CONFIG } from "@repo/config/constants";
import { db } from "@repo/database";
import { userHasAccess } from "@repo/database/prisma/queries/access";
import {
	BILLING_UPGRADE_CUSTOM_ID,
	ONBOARDING_COMPLETE_CUSTOM_ID,
	removeGuildMemberRole,
} from "@repo/discord";
import { logger } from "@repo/logs";
import { createCustomerPortalLink } from "@repo/payments";
import {
	InteractionResponseFlags,
	InteractionResponseType,
	InteractionType,
	verifyKey,
} from "discord-interactions";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getAccountBillingUrl(): string {
	const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
	if (base) {
		return `${base}/app/settings/billing`;
	}
	return "https://www.lifepreneur.io/app/settings/billing";
}

function ephemeralResponse(content: string) {
	return NextResponse.json({
		type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
		data: {
			content,
			flags: InteractionResponseFlags.EPHEMERAL,
		},
	});
}

interface DiscordInteractionBody {
	type: number;
	member?: { user?: { id?: string } };
	user?: { id?: string };
	data?: {
		component_type?: number;
		custom_id?: string;
	};
}

export async function POST(request: Request) {
	const publicKey = process.env.DISCORD_PUBLIC_KEY;
	if (!publicKey) {
		return NextResponse.json(
			{ error: "DISCORD_PUBLIC_KEY is not configured" },
			{ status: 503 },
		);
	}

	const signature = request.headers.get("x-signature-ed25519");
	const timestamp = request.headers.get("x-signature-timestamp");
	if (!signature || !timestamp) {
		return NextResponse.json(
			{ error: "Missing signature headers" },
			{
				status: 401,
			},
		);
	}

	const rawBody = await request.text();
	const isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
	if (!isValid) {
		return NextResponse.json(
			{ error: "Invalid signature" },
			{
				status: 401,
			},
		);
	}

	let interaction: DiscordInteractionBody;
	try {
		interaction = JSON.parse(rawBody) as DiscordInteractionBody;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (interaction.type === InteractionType.PING) {
		return NextResponse.json({ type: InteractionResponseType.PONG });
	}

	if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
		const { data } = interaction;
		if (
			data?.component_type === 2 &&
			data.custom_id === BILLING_UPGRADE_CUSTOM_ID
		) {
			const discordUserId =
				interaction.member?.user?.id ?? interaction.user?.id;
			if (!discordUserId) {
				return ephemeralResponse(
					"Could not identify your Discord account. Try again from the server channel.",
				);
			}

			const user = await db.user.findFirst({
				where: { discordId: discordUserId },
				select: { paymentsCustomerId: true },
			});

			const billingUrl = getAccountBillingUrl();

			if (!user?.paymentsCustomerId) {
				return ephemeralResponse(
					`No billing profile found for this Discord account. Connect the same account in the app first, then try again.\n\n${billingUrl}`,
				);
			}

			try {
				const portalUrl = await createCustomerPortalLink({
					customerId: user.paymentsCustomerId,
					redirectUrl: billingUrl,
				});

				if (!portalUrl) {
					logger.warn(
						"Discord billing_upgrade: portal URL was null",
						{
							discordUserId,
						},
					);
					return ephemeralResponse(
						`Could not open billing right now. Use the app instead:\n\n${billingUrl}`,
					);
				}

				return ephemeralResponse(
					`**Your billing portal (personal link)**\n${portalUrl}\n\nLink expires after a short time. If it fails, open:\n${billingUrl}`,
				);
			} catch (error) {
				logger.error(
					"Discord billing_upgrade: portal creation failed",
					{
						discordUserId,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				);
				return ephemeralResponse(
					`Could not open billing right now. Use the app instead:\n\n${billingUrl}`,
				);
			}
		}

		if (
			data?.component_type === 2 &&
			data.custom_id === ONBOARDING_COMPLETE_CUSTOM_ID
		) {
			const discordUserId =
				interaction.member?.user?.id ?? interaction.user?.id;
			if (!discordUserId) {
				return ephemeralResponse(
					"Could not identify your Discord account. Try again from the server channel.",
				);
			}

			const roleId = DISCORD_CONFIG.notOnboardedRoleId?.trim();
			if (!roleId) {
				logger.error(
					"Discord onboarding_complete: DISCORD_NOT_ONBOARDED_ROLE_ID missing",
				);
				return ephemeralResponse(
					"Onboarding is not configured. Please contact support.",
				);
			}

			const user = await db.user.findFirst({
				where: { discordId: discordUserId },
				select: { id: true, discordConnected: true },
			});

			if (!user?.discordConnected) {
				return ephemeralResponse(
					"Connect your Discord account in the Lifepreneur app first, then try again.",
				);
			}

			const hasAccess = await userHasAccess(user.id);
			if (!hasAccess) {
				return ephemeralResponse(
					"Your account does not have active access. If you believe this is wrong, contact support.",
				);
			}

			const removed = await removeGuildMemberRole(
				discordUserId,
				roleId,
				"Lifepreneur: onboarding complete (remove gate role)",
			);

			if (!removed.success) {
				logger.warn("Discord onboarding_complete: remove role failed", {
					discordUserId,
					error: removed.error,
				});
				return ephemeralResponse(
					`Could not update your access: ${removed.error ?? "Unknown error"}. Try again or contact support.`,
				);
			}

			return ephemeralResponse(
				"**Welcome!** You now have access to the community channels.",
			);
		}
	}

	return ephemeralResponse("That action is not available.");
}
