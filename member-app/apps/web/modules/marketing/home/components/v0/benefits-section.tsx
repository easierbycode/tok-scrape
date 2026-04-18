import {
	getCachedMarketingBenefits,
	getCachedMarketingContent,
} from "@marketing/lib/marketing-content-cache";
import { BenefitsGrid } from "./benefits-grid";

const defaultBenefits = [
	{
		icon: "GraduationCap",
		heading: "Live Training, Every Week",
		bullets: [
			"Weekly live sessions with real strategies",
			"Actionable training across platforms and skills",
			"Session replays available in the community",
			"Ask questions and get answers in real-time",
		],
	},
	{
		icon: "Users",
		heading: "Private Creator Community",
		bullets: [
			"Connect with driven creators at every stage",
			"Share wins, get feedback, find accountability partners",
			"Dedicated channels by topic and experience level",
			"A community that actually shows up for each other",
		],
	},
	{
		icon: "DollarSign",
		heading: "Affiliate Program",
		bullets: [
			"Earn commissions sharing what you already use",
			"Dedicated affiliate resources and support",
			"Track your referrals and earnings in your dashboard",
			"Turn your network into a revenue stream",
		],
	},
];

export async function BenefitsSection() {
	const [dbBenefits, content] = await Promise.all([
		getCachedMarketingBenefits(),
		getCachedMarketingContent(),
	]);

	const benefits = dbBenefits
		? dbBenefits.map((b) => ({
				icon: b.icon,
				heading: b.heading,
				bullets: b.bullets,
			}))
		: defaultBenefits;

	const headline = content?.benefitsHeadline || "Everything You Need to Grow";

	return (
		<section id="benefits" className="pt-24 pb-12 md:pt-32 md:pb-20">
			<div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-16">
				<BenefitsGrid benefits={benefits} headline={headline} />
			</div>
		</section>
	);
}
