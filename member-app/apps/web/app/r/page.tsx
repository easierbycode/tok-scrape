import { db } from "@repo/database";
import { Logo } from "@shared/components/Logo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Construction } from "@/modules/ui/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Updating our plans",
	description:
		"Our affiliate link is temporarily paused while we finalize new pricing options.",
};

export default async function AffiliateRedirectPage() {
	let affiliateLinkComingSoon = false;
	try {
		const row = await db.marketingContent.findUnique({
			where: { id: "singleton" },
			select: { affiliateLinkComingSoon: true },
		});
		affiliateLinkComingSoon = row?.affiliateLinkComingSoon ?? false;
	} catch {
		// Table missing or DB error — fall back to redirect (legacy behavior)
	}

	if (!affiliateLinkComingSoon) {
		redirect("/#pricing");
	}

	return (
		<div className="relative flex min-h-screen flex-col items-center justify-center p-8">
			<div className="mb-8 flex flex-col items-center gap-4">
				<Logo withLabel />
			</div>

			<Construction className="mb-6 h-16 w-16 text-primary" />

			<h1 className="mb-4 max-w-lg text-center text-3xl font-bold text-balance">
				We&apos;re Updating Our Plans
			</h1>

			<p className="max-w-md text-center text-lg text-muted-foreground text-pretty">
				Our affiliate link is temporarily paused while we finalize our
				new pricing options. Check back very soon!
			</p>
		</div>
	);
}
