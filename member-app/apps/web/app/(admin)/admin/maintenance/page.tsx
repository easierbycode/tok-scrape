"use client";

import { config } from "@repo/config";
import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@ui/components/card";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Construction, Settings2 } from "@/modules/ui/icons";

export default function MaintenancePage() {
	const [dbEnabled, setDbEnabled] = useState<boolean | null>(null);
	const [loading, setLoading] = useState(true);
	const [toggling, setToggling] = useState(false);
	const [estimatedEndTime, setEstimatedEndTime] = useState("");
	const [savingEndTime, setSavingEndTime] = useState(false);

	const envEnabled = config.maintenance.enabled;

	useEffect(() => {
		async function fetchStatus() {
			try {
				const res = await fetch("/api/admin/maintenance");
				if (res.ok) {
					const data = (await res.json()) as {
						enabled: boolean;
						estimatedEndTime: string | null;
					};
					setDbEnabled(data.enabled);
					if (data.estimatedEndTime) {
						// Convert ISO string to datetime-local format
						const date = new Date(data.estimatedEndTime);
						const local = new Date(
							date.getTime() - date.getTimezoneOffset() * 60000,
						)
							.toISOString()
							.slice(0, 16);
						setEstimatedEndTime(local);
					}
				} else {
					setDbEnabled(null);
				}
			} catch {
				setDbEnabled(null);
			} finally {
				setLoading(false);
			}
		}
		fetchStatus();
	}, []);

	const handleToggle = async () => {
		if (dbEnabled === null) {
			return;
		}
		const newEnabled = !dbEnabled;
		setToggling(true);
		try {
			const res = await fetch("/api/admin/maintenance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					enabled: newEnabled,
					// When enabling, send the end time; when disabling, clear it
					estimatedEndTime:
						newEnabled && estimatedEndTime
							? new Date(estimatedEndTime).toISOString()
							: null,
				}),
			});
			if (res.ok) {
				const data = (await res.json()) as { enabled: boolean };
				setDbEnabled(data.enabled);
				if (!data.enabled) {
					setEstimatedEndTime("");
				}
				toast.success(
					data.enabled
						? "Maintenance mode enabled (database)"
						: "Maintenance mode disabled (database)",
				);
			} else {
				toast.error("Failed to update maintenance status");
			}
		} catch {
			toast.error("Failed to update maintenance status");
		} finally {
			setToggling(false);
		}
	};

	const handleSaveEndTime = async () => {
		setSavingEndTime(true);
		try {
			const res = await fetch("/api/admin/maintenance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					enabled: dbEnabled,
					estimatedEndTime: estimatedEndTime
						? new Date(estimatedEndTime).toISOString()
						: null,
				}),
			});
			if (res.ok) {
				toast.success(
					estimatedEndTime
						? "Estimated end time updated"
						: "Estimated end time cleared",
				);
			} else {
				toast.error("Failed to update estimated end time");
			}
		} catch {
			toast.error("Failed to update estimated end time");
		} finally {
			setSavingEndTime(false);
		}
	};

	const effectiveStatus = envEnabled || dbEnabled === true;
	const statusSource = envEnabled
		? "env var"
		: dbEnabled
			? "database"
			: "off";

	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">
					Maintenance Mode
				</h1>
				<p className="text-muted-foreground mt-2">
					Control planned maintenance and view emergency fallback
					instructions.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Construction className="h-5 w-5" />
						Current Status
					</CardTitle>
					<CardDescription>
						Maintenance mode uses two triggers: env var (emergency
						fallback, works when DB is down) and database toggle
						(planned maintenance).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between rounded-lg border p-4">
						<div>
							<p className="font-medium">
								{effectiveStatus
									? "Maintenance mode is ON"
									: "Maintenance mode is OFF"}
							</p>
							<p className="text-sm text-muted-foreground">
								Source: {statusSource}
								{envEnabled && " (env var overrides database)"}
							</p>
						</div>
						{!envEnabled && (
							<Button
								variant={dbEnabled ? "error" : "primary"}
								onClick={handleToggle}
								disabled={loading || toggling}
							>
								{loading || toggling
									? "..."
									: dbEnabled
										? "Disable"
										: "Enable"}
							</Button>
						)}
					</div>

					{envEnabled && (
						<p className="text-sm text-muted-foreground">
							Env var MAINTENANCE_MODE=true is set. Disable it in
							Vercel and redeploy to turn off maintenance mode.
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Estimated End Time
					</CardTitle>
					<CardDescription>
						Set an estimated end time to display on the maintenance
						page. Users will see when you expect to be back.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-end gap-3">
						<div className="flex-1">
							<label
								htmlFor="end-time"
								className="text-sm font-medium mb-1.5 block"
							>
								End time
							</label>
							<input
								id="end-time"
								type="datetime-local"
								value={estimatedEndTime}
								onChange={(e) =>
									setEstimatedEndTime(e.target.value)
								}
								className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							/>
						</div>
						<Button
							variant="outline"
							onClick={handleSaveEndTime}
							disabled={savingEndTime || loading}
						>
							{savingEndTime ? "..." : "Save"}
						</Button>
						{estimatedEndTime && (
							<Button
								variant="ghost"
								onClick={() => {
									setEstimatedEndTime("");
									handleSaveEndTime();
								}}
								disabled={savingEndTime || loading}
							>
								Clear
							</Button>
						)}
					</div>
					{estimatedEndTime && (
						<p className="text-sm text-muted-foreground">
							Users will see: "Expected back by:{" "}
							{new Date(estimatedEndTime).toLocaleString()}"
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings2 className="h-5 w-5" />
						Emergency Fallback (Env Var)
					</CardTitle>
					<CardDescription>
						When the database is down, use Vercel environment
						variables to enable maintenance mode. Requires a
						redeploy (~2–3 min).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted p-4 font-mono text-sm">
						<p className="font-semibold mb-2">To enable:</p>
						<pre className="whitespace-pre-wrap break-all">
							{`MAINTENANCE_MODE=true
MAINTENANCE_MESSAGE="We're upgrading! Back in 15 minutes."
MAINTENANCE_END_TIME="2026-02-14T12:00:00Z"  # Optional, ISO 8601`}
						</pre>
						<p className="font-semibold mt-4 mb-2">To disable:</p>
						<pre className="whitespace-pre-wrap">
							MAINTENANCE_MODE=false
						</pre>
					</div>
					<p className="text-sm text-muted-foreground">
						Set these in Vercel Dashboard → Project → Settings →
						Environment Variables, then trigger a redeploy.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
