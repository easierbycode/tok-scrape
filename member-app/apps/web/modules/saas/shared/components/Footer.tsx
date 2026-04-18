import { LocaleLink } from "@i18n/routing";
import { cn } from "@ui/lib";

export function Footer() {
	return (
		<footer
			className={cn(
				"container max-w-6xl py-6 text-center text-muted-foreground text-xs",
			)}
		>
			<LocaleLink href="/legal/privacy-policy">Privacy policy</LocaleLink>
			<span className="text-muted-foreground/60"> | </span>
			<LocaleLink href="/legal/terms">Terms and conditions</LocaleLink>
		</footer>
	);
}
