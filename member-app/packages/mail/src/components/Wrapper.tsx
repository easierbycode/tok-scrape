import {
	Container,
	Font,
	Head,
	Html,
	Section,
	Tailwind,
} from "@react-email/components";
import React, { type PropsWithChildren } from "react";
import { Logo } from "./Logo";

export default function Wrapper({ children }: PropsWithChildren) {
	return (
		<Tailwind
			config={{
				theme: {
					extend: {
						colors: {
							border: "#e8e6e1",
							background: "#fafaf8",
							foreground: "#1a1a2e",
							primary: {
								DEFAULT: "#e8650a",
								foreground: "#ffffff",
							},
							secondary: {
								DEFAULT: "#1a1a2e",
								foreground: "#ffffff",
							},
							muted: {
								DEFAULT: "#f3f2ef",
								foreground: "#64647a",
							},
							accent: {
								DEFAULT: "#fef0e6",
								foreground: "#1a1a2e",
							},
							destructive: {
								DEFAULT: "#ef4444",
								foreground: "#ffffff",
							},
							card: {
								DEFAULT: "#ffffff",
								foreground: "#1a1a2e",
							},
						},
					},
				},
			}}
		>
			<Html lang="en">
				<Head>
					<Font
						fontFamily="Inter"
						fallbackFontFamily="Arial"
						fontWeight={400}
						fontStyle="normal"
					/>
				</Head>
				<Section className="bg-background p-4">
					<Container className="rounded-lg bg-card p-6 text-card-foreground">
						<Logo />
						{children}
					</Container>
				</Section>
			</Html>
		</Tailwind>
	);
}
