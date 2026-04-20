/**
 * One-off: post an upgrade CTA with a link button to account billing.
 *
 * Run from repo root (loads .env; use pnpm so dotenv-cli is on PATH):
 *   pnpm exec dotenv -e .env -- pnpm exec tsx scripts/post-discord-upgrade-cta.ts
 */

import "dotenv/config";
import { getDiscordBotUserAgent } from "@repo/discord";

const CHANNEL_ID = "1491172823492858007";
const BILLING_URL = "https://www.lifepreneur.io/app/settings/billing";

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
						style: 5,
						label: "Upgrade",
						url: BILLING_URL,
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
