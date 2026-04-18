"use client";

import {
	DEV_FLAGS,
	type DevFlagKey,
	getDevFlag,
	setDevFlag,
} from "@repo/config/dev-flags";
import { Button } from "@ui/components/button";
import { useEffect, useState } from "react";
import { Settings, X } from "@/modules/ui/icons";

export function DevToolsPanel() {
	const [isOpen, setIsOpen] = useState(false);
	const [flags, setFlags] = useState<Record<string, boolean>>({});

	useEffect(() => {
		if (process.env.NODE_ENV !== "development") {
			return;
		}

		// Load current flag state from localStorage
		const flagState = Object.fromEntries(
			Object.keys(DEV_FLAGS).map((key) => [
				key,
				getDevFlag(key as DevFlagKey),
			]),
		);
		setFlags(flagState);
	}, []);

	if (process.env.NODE_ENV !== "development") {
		return null;
	}

	const handleReset = () => {
		if (confirm("Clear all dev data and return to login?")) {
			localStorage.clear();
			window.location.href = "/auth/login";
		}
	};

	return (
		<>
			{!isOpen && (
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					className="fixed bottom-4 right-4 z-50 bg-orange-500 text-white p-3 rounded-full shadow-lg hover:bg-orange-600 transition-colors"
					aria-label="Open dev tools"
				>
					<Settings className="w-5 h-5" />
				</button>
			)}

			{isOpen && (
				<div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-xl w-80 max-h-[32rem] overflow-auto">
					<div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
						<h3 className="font-semibold">Dev Tools</h3>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-muted-foreground hover:text-foreground"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="p-4 space-y-4">
						{/* Feature Flags Section */}
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground uppercase">
								Feature Flags
							</p>

							<div className="space-y-2">
								{Object.entries(DEV_FLAGS).map(
									([key, config]) => (
										<div
											key={key}
											className="flex items-center justify-between p-2 rounded-md bg-muted/50"
										>
											<span className="text-sm">
												{config.description}
											</span>
											<input
												type="checkbox"
												checked={flags[key] || false}
												onChange={(e) => {
													const newValue =
														e.target.checked;
													setDevFlag(
														key as DevFlagKey,
														newValue,
													);
													setFlags((prev) => ({
														...prev,
														[key]: newValue,
													}));
												}}
												className="h-4 w-4"
											/>
										</div>
									),
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-2">
								Changes persist in localStorage and cookies. No
								restart needed.
							</p>
						</div>

						{/* Reset */}
						<div className="pt-4 border-t border-border space-y-2">
							<Button
								onClick={handleReset}
								variant="error"
								size="sm"
								className="w-full"
							>
								🔄 Clear Data & Logout
							</Button>

							<p className="text-xs text-muted-foreground text-center">
								Clears localStorage and redirects to login
							</p>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
