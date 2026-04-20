import { LocaleLink } from "@i18n/routing";
import { config } from "@repo/config";
import { Logo } from "@shared/components/Logo";

export function Footer() {
	return (
		<footer className="border-t bg-muted py-8 text-sm text-muted-foreground">
			<div className="container grid grid-cols-1 gap-6 sm:gap-8 sm:grid-cols-3">
				{/* Column 1: Branding */}
				<div>
					<Logo className="opacity-70 grayscale" />
					<p className="mt-3 text-sm text-muted-foreground/90">
						© {new Date().getFullYear()} {config.appName}.
					</p>
				</div>

				{/* Column 2: Support */}
				<div className="flex flex-col gap-2">
					<h3 className="mb-1 font-semibold text-foreground text-xs uppercase tracking-wider">
						Support
					</h3>
					<LocaleLink
						href="/helpcenter"
						className="block hover:text-foreground transition-colors"
					>
						Help Center
					</LocaleLink>
					<LocaleLink
						href="/contact"
						className="block hover:text-foreground transition-colors"
					>
						Contact
					</LocaleLink>
				</div>

				{/* Column 3: Legal */}
				<div className="flex flex-col gap-2">
					<h3 className="mb-1 font-semibold text-foreground text-xs uppercase tracking-wider">
						Legal
					</h3>
					<LocaleLink
						href="/legal/privacy-policy"
						className="block hover:text-foreground transition-colors"
					>
						Privacy
					</LocaleLink>
					<LocaleLink
						href="/legal/terms"
						className="block hover:text-foreground transition-colors"
					>
						Terms
					</LocaleLink>
					<LocaleLink
						href="/legal/refunds"
						className="block hover:text-foreground transition-colors"
					>
						Refunds
					</LocaleLink>
					<LocaleLink
						href="/studio-verification"
						className="block hover:text-foreground transition-colors"
					>
						Studio
					</LocaleLink>
				</div>
			</div>
		</footer>
	);
}
