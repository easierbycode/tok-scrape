/**
 * One-off: post a Primary (green) billing CTA button. Clicks are handled by
 * POST /api/discord/interactions (requires DISCORD_PUBLIC_KEY + Interactions URL in the Developer Portal).
 *
 * Run from repo root:
 *   pnpm exec dotenv -e .env -- pnpm exec tsx scripts/post-discord-billing-primary-button.ts
 */

import "dotenv/config";
import { getDiscordBotUserAgent } from "@repo/discord";

const CHANNEL_ID = "1491172823492858007";

/** Must match apps/web/app/api/discord/interactions/route.ts */
const BILLING_BUTTON_CUSTOM_ID = "billing_upgrade";

async function main() {
	const token = process.env.DISCORD_BOT_TOKEN;
	if (!token) {
		console.error("DISCORD_BOT_TOKEN is not set");
		process.exit(1);
	}

	const body = {
		content: "Upgrade here - You must be signed into lifepreneur.io",
		components: [
			{
				type: 1,
				components: [
					{
						type: 2,
						style: 1,
						label: "Upgrade",
						custom_id: BILLING_BUTTON_CUSTOM_ID,
					},
				],
			},
		],
	};

	const response = await fetch(
		`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
		{
			method: "POST",
			headers: {
				Authorization: `Bot ${token}`,
				"Content-Type": "application/json",
				"User-Agent": getDiscordBotUserAgent(),
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		console.error("Discord API error:", response.status, text);
		process.exit(1);
	}

	const data = (await response.json()) as { id?: string };
	console.log("Posted message id:", data.id ?? "(unknown)");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
