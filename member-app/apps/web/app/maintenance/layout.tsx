import { Document } from "@shared/components/Document";
import type { PropsWithChildren } from "react";

export default function MaintenanceLayout({ children }: PropsWithChildren) {
	return <Document locale="en">{children}</Document>;
}
