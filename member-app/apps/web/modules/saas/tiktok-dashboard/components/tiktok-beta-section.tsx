import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import Link from "next/link";
import { BarChart3 } from "@/modules/ui/icons";
import { TikTokIcon } from "./tiktok-icon";

interface TikTokBetaSectionProps {
	hasBetaAccess: boolean;
}

export function TikTokBetaSection({ hasBetaAccess }: TikTokBetaSectionProps) {
	if (!hasBetaAccess) {
		return null;
	}

	return (
		<div className="container mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
			<Card className="overflow-hidden border-l-4 border-l-primary">
				<CardContent className="p-5 sm:p-6">
					<div className="flex flex-col gap-4">
						<div className="flex items-start gap-3 sm:gap-4">
							<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/15 sm:h-14 sm:w-14">
								<TikTokIcon className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
							</div>
							<div className="flex-1">
								<h3 className="flex items-center gap-2 font-serif font-bold tracking-tight text-lg sm:text-xl">
									TikTok Dashboard
									<Badge status="warning" className="text-xs">
										Beta
									</Badge>
								</h3>
								<p className="text-sm text-muted-foreground sm:text-base">
									Track your TikTok accounts, set content
									goals, and manage brand campaigns — all in
									one place.
								</p>
							</div>
						</div>
						<Button
							asChild
							variant="primary"
							size="lg"
							className="w-full shrink-0 px-6 text-base font-semibold shadow-raised sm:w-auto"
						>
							<Link href="/app/tiktok-shop">
								<BarChart3 className="mr-2 h-4 w-4" />
								Open Dashboard
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
