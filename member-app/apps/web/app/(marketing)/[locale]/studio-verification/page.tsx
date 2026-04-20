import { Card, CardContent } from "@ui/components/card";
import { Separator } from "@ui/components/separator";
import type { Metadata } from "next";
import Link from "next/link";
import {
	CalendarDays,
	CheckCircle2,
	FileCheck,
	Hash,
	Mail,
	ShieldCheck,
	Signature,
} from "@/modules/ui/icons";

export const metadata: Metadata = {
	title: "Studio Verification — Lifepreneur Studios",
	description:
		"Verify Creator Filming Authorization & Content Usage Licenses issued by Lifepreneur Studios.",
};

const licenseConfirms = [
	{
		icon: ShieldCheck,
		label: "Permission to film at the studio",
		description:
			"The creator was granted authorized access to record inside Lifepreneur Studios.",
	},
	{
		icon: FileCheck,
		label: "Content recorded inside the studio",
		description:
			"The license covers content produced during the authorized session at our Arizona facility.",
	},
	{
		icon: CheckCircle2,
		label: "Authorization to publish and monetize",
		description:
			"The creator is permitted to publish and monetize the content produced during their session.",
	},
	{
		icon: ShieldCheck,
		label: "Usage for social media and promotion",
		description:
			"Authorized for use on TikTok, TikTok Shop, YouTube, and other social media platforms.",
	},
];

const licenseFields = [
	{
		icon: Hash,
		label: "TikTok Handle",
		description:
			"The creator's TikTok account identifier as listed on the license.",
	},
	{
		icon: FileCheck,
		label: "Authorization ID",
		description:
			"A unique reference number identifying the specific license issued.",
	},
	{
		icon: CalendarDays,
		label: "License Term",
		description:
			"The valid date range during which the authorization applies.",
	},
	{
		icon: Signature,
		label: "Signature",
		description:
			"Digital signature from Lifepreneur Studios confirming authorization.",
	},
];

export default function StudioVerificationPage() {
	return (
		<div className="container max-w-3xl pt-32 pb-24">
			{/* Sub-brand header */}
			<div className="mb-10 text-center">
				<div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-5 py-2 mb-4">
					<span className="text-xs font-semibold tracking-widest uppercase text-primary">
						Lifepreneur Studios
					</span>
				</div>
				<h1 className="font-bold text-4xl mb-3">
					Creator Filming Authorization Verification
				</h1>
				<p className="text-muted-foreground text-lg max-w-xl mx-auto">
					Lifepreneur Studios is a commercial creator production
					studio located in Arizona. This page explains how to verify
					a Creator Filming Authorization &amp; Content Usage License
					issued by our studio.
				</p>
			</div>

			<Separator className="mb-10" />

			{/* What the license confirms */}
			<section className="mb-12">
				<h2 className="font-semibold text-xl mb-1">
					What the License Confirms
				</h2>
				<p className="text-muted-foreground text-sm mb-6">
					A valid license issued by Lifepreneur Studios confirms all
					of the following for the listed creator.
				</p>
				<div className="grid gap-4 sm:grid-cols-2">
					{licenseConfirms.map(
						({ icon: Icon, label, description }) => (
							<Card key={label} className="border bg-muted/30">
								<CardContent className="p-5 flex gap-4 items-start">
									<div className="rounded-md bg-primary/10 p-2 shrink-0 mt-0.5">
										<Icon className="h-4 w-4 text-primary" />
									</div>
									<div>
										<p className="font-medium text-sm mb-1">
											{label}
										</p>
										<p className="text-muted-foreground text-xs leading-relaxed">
											{description}
										</p>
									</div>
								</CardContent>
							</Card>
						),
					)}
				</div>
			</section>

			{/* License fields */}
			<section className="mb-12">
				<h2 className="font-semibold text-xl mb-1">License Details</h2>
				<p className="text-muted-foreground text-sm mb-6">
					Every license issued by Lifepreneur Studios includes the
					following information. When verifying a license, confirm
					these fields are present and match the creator in question.
				</p>
				<div className="grid gap-4 sm:grid-cols-2">
					{licenseFields.map(
						({ icon: Icon, label, description }, index) => (
							<div key={label} className="flex gap-4 items-start">
								<div className="rounded-full bg-muted border w-8 h-8 flex items-center justify-center shrink-0 text-muted-foreground font-semibold text-xs">
									{index + 1}
								</div>
								<div>
									<div className="flex items-center gap-2 mb-1">
										<Icon className="h-3.5 w-3.5 text-primary" />
										<p className="font-medium text-sm">
											{label}
										</p>
									</div>
									<p className="text-muted-foreground text-xs leading-relaxed">
										{description}
									</p>
								</div>
							</div>
						),
					)}
				</div>
			</section>

			{/* Verification statement */}
			<Card className="mb-10 border-primary/20 bg-primary/5">
				<CardContent className="p-6">
					<div className="flex gap-4 items-start">
						<div className="rounded-md bg-primary/10 p-2 shrink-0 mt-0.5">
							<ShieldCheck className="h-5 w-5 text-primary" />
						</div>
						<div>
							<h3 className="font-semibold mb-2">
								Verification Statement
							</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								If you are reviewing a license issued by
								Lifepreneur Studios, the document confirms that
								the listed creator was authorized to film and
								publish content recorded at our studio facility.
								Each license is signed digitally by Lifepreneur
								Studios and includes a unique Authorization ID
								for reference.
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Contact / request verification */}
			<section className="text-center">
				<h2 className="font-semibold text-lg mb-2">
					Still have questions?
				</h2>
				<p className="text-muted-foreground text-sm mb-5">
					If you need to confirm the validity of a specific license or
					have questions about a creator's authorization, contact us
					directly.
				</p>
				<Link
					href="mailto:support@lifepreneur.com?subject=Studio%20License%20Verification%20Request"
					className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
				>
					<Mail className="h-4 w-4" />
					Request Verification
				</Link>
				<p className="mt-4 text-muted-foreground text-xs">
					Include the Authorization ID and creator's TikTok handle in
					your email.
				</p>
			</section>
		</div>
	);
}
