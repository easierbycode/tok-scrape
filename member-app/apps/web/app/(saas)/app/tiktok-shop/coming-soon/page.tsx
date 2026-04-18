import { Button } from "@ui/components/button";
import Link from "next/link";

export default function TiktokShopComingSoonPage() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-brand-glow md:shadow-brand-glow-desktop">
				<span className="text-2xl font-bold text-primary-foreground">
					L
				</span>
			</div>
			<h1 className="mt-6 font-serif font-bold tracking-tight text-3xl">
				TikTok Shop
			</h1>
			<p className="mt-3 max-w-md text-muted-foreground">
				The TikTok Shop dashboard is currently in beta. You&apos;ll get
				access once you&apos;re approved for the beta program.
			</p>
			<Button asChild variant="primary" size="lg" className="mt-8">
				<Link href="/app/community">Back to Community</Link>
			</Button>
		</div>
	);
}
