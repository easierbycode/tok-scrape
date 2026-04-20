import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import { config } from "@repo/config";

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#fafaf8" },
		{ media: "(prefers-color-scheme: dark)", color: "#0f0f17" },
	],
};

export default function RootLayout({ children }: PropsWithChildren) {
	return children;
}
