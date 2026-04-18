import Link from "next/link";
import { ExternalLink } from "@/modules/ui/icons";
import { TikTokIcon } from "./tiktok-icon";

const accounts = [
	{
		id: "1",
		username: "@creativejane",
		platform: "TikTok",
		followers: "62.3K",
	},
	{
		id: "2",
		username: "@janecreates",
		platform: "TikTok",
		followers: "62.2K",
	},
];

export function ConnectedAccounts() {
	return (
		<section>
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-serif font-bold tracking-tight text-base text-foreground">
					Connected Accounts
				</h2>
				<Link
					href="/app/tiktok-shop/profile"
					className="text-sm text-primary hover:underline"
				>
					View all
				</Link>
			</div>
			<div className="grid grid-cols-2 gap-3">
				{accounts.map((account) => (
					<div
						key={account.id}
						className="rounded-2xl border border-border bg-card p-4 shadow-flat"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<TikTokIcon className="h-5 w-5 text-foreground" />
								<span className="text-sm font-medium text-foreground">
									{account.platform}
								</span>
							</div>
							<ExternalLink className="h-4 w-4 text-muted-foreground" />
						</div>

						<div className="mt-3">
							<p className="text-sm font-medium text-foreground">
								{account.username}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								{account.followers} followers
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
