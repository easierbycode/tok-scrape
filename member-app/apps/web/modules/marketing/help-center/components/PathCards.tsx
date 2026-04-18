import { Card } from "@ui/components/card";
import Link from "next/link";
import { ArrowRight, Sparkles, UserCheck } from "@/modules/ui/icons";

interface PathCardsProps {
	isSignedIn: boolean;
}

const buyerCard = (
	<Link href="/helpcenter?path=buyer" className="block">
		<Card className="group h-full p-5 shadow-flat transition-[transform,box-shadow] duration-300 hover:border-primary hover:shadow-elevated md:hover:shadow-elevated-desktop sm:p-6">
			<div className="flex items-start gap-4">
				<div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors shrink-0">
					<Sparkles className="h-6 w-6 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
						Thinking about joining?
					</h3>
					<p className="text-sm text-muted-foreground mb-3">
						Learn what LifePreneur is, what you get with membership,
						and how billing works.
					</p>
					<div className="flex items-center gap-2 text-sm text-primary font-medium">
						<span>View topics</span>
						<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
					</div>
				</div>
			</div>
		</Card>
	</Link>
);

const memberCard = (
	<Link href="/helpcenter?path=member" className="block">
		<Card className="group h-full p-5 shadow-flat transition-[transform,box-shadow] duration-300 hover:border-primary hover:shadow-elevated md:hover:shadow-elevated-desktop sm:p-6">
			<div className="flex items-start gap-4">
				<div className="rounded-lg bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors shrink-0">
					<UserCheck className="h-6 w-6 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
						Already a member?
					</h3>
					<p className="text-sm text-muted-foreground mb-3">
						Guides for Discord, community, billing, account
						settings, and your affiliate dashboard.
					</p>
					<div className="flex items-center gap-2 text-sm text-primary font-medium">
						<span>Member guides</span>
						<ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
					</div>
				</div>
			</div>
		</Card>
	</Link>
);

export function PathCards({ isSignedIn }: PathCardsProps) {
	return (
		<div className="grid gap-4 sm:gap-5 md:grid-cols-2">
			{isSignedIn ? (
				<>
					{memberCard}
					{buyerCard}
				</>
			) : (
				<>
					{buyerCard}
					{memberCard}
				</>
			)}
		</div>
	);
}
