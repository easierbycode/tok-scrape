import { DiscordMessageStudio } from "@saas/admin/component/discord/DiscordMessageStudio";
import { notFound } from "next/navigation";

export default function DiscordMessageStudioPage() {
	if (process.env.DISCORD_MESSAGE_STUDIO_ENABLED === "false") {
		notFound();
	}

	return (
		<div className="container mx-auto max-w-4xl py-8">
			<div className="mb-6">
				<h1 className="text-3xl font-bold">Discord Message Studio</h1>
				<p className="text-muted-foreground mt-1">
					Compose embeds and buttons, post or edit bot messages, and
					save templates without redeploying.
				</p>
			</div>
			<DiscordMessageStudio />
		</div>
	);
}
