"use client";

import { Button } from "@ui/components/button";
import { useState } from "react";

export function CheckAgainButton() {
	const [isChecking, setIsChecking] = useState(false);

	async function handleClick() {
		setIsChecking(true);
		try {
			const res = await fetch("/api/admin/maintenance", {
				cache: "no-store",
			});
			if (res.ok) {
				const data = (await res.json()) as { enabled?: boolean };
				if (!data.enabled) {
					window.location.href = "/";
					return;
				}
			}
		} catch {
			// fall through to reload on error
		}
		window.location.reload();
	}

	return (
		<Button variant="outline" onClick={handleClick} disabled={isChecking}>
			{isChecking ? "Checking..." : "Check Again"}
		</Button>
	);
}
