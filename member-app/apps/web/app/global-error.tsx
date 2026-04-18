"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error, {
			tags: {
				component: "GlobalError",
				digest: error.digest,
			},
		});
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					margin: 0,
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#0f0f17",
					color: "#fafaf8",
					fontFamily:
						"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
					padding: "1.5rem",
				}}
			>
				<div
					style={{
						maxWidth: "28rem",
						width: "100%",
						textAlign: "center",
						padding: "2rem",
						border: "1px solid rgba(250, 250, 248, 0.1)",
						borderRadius: "1rem",
						backgroundColor: "rgba(250, 250, 248, 0.02)",
					}}
				>
					<h1
						style={{
							margin: "0 0 0.75rem",
							fontSize: "1.5rem",
							fontWeight: 600,
						}}
					>
						The page crashed
					</h1>
					<p
						style={{
							margin: "0 0 1.5rem",
							fontSize: "0.875rem",
							opacity: 0.7,
							lineHeight: 1.5,
						}}
					>
						A critical error prevented this page from rendering. Try
						reloading — if the problem continues, please contact
						support.
					</p>
					{error.digest && (
						<p
							style={{
								margin: "0 0 1.5rem",
								fontSize: "0.75rem",
								opacity: 0.5,
								fontFamily: "monospace",
							}}
						>
							Reference: {error.digest}
						</p>
					)}
					<button
						type="button"
						onClick={reset}
						style={{
							padding: "0.625rem 1.25rem",
							fontSize: "0.875rem",
							fontWeight: 500,
							color: "#fafaf8",
							backgroundColor: "#e8650a",
							border: "none",
							borderRadius: "0.5rem",
							cursor: "pointer",
						}}
					>
						Reload page
					</button>
				</div>
			</body>
		</html>
	);
}
