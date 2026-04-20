import { Document } from "@shared/components/Document";
import type { PropsWithChildren } from "react";

export default function AffiliateRedirectLayout({
	children,
}: PropsWithChildren) {
	return <Document locale="en">{children}</Document>;
}
