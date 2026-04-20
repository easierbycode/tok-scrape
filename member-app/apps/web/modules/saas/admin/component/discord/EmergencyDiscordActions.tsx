"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ui/components/card";
import { Input } from "@ui/components/input";
import { Textarea } from "@ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "@/modules/ui/icons";

export function EmergencyDiscordActions() {
	const [reason, setReason] = useState("");
	const [confirmText, setConfirmText] = useState("");

	const disconnectAllMutation = useMutation(
		orpc.admin.discord.emergencyDisconnectAll.mutationOptions(),
	);

	const handleDisconnectAll = async () => {
		if (confirmText !== "DISCONNECT ALL USERS") {
			toast.error("Confirmation text does not match");
			return;
		}

		if (reason.length < 10) {
			toast.error("Reason must be at least 10 characters");
			return;
		}

		if (
			!confirm(
				"This will disconnect ALL users from Discord. Are you absolutely sure?",
			)
		) {
			return;
		}

		try {
			const result = await disconnectAllMutation.mutateAsync({
				reason,
				confirmationText: confirmText,
			});

			toast.success(`Disconnected ${result.summary.successCount} users`);
			if (result.summary.failCount > 0) {
				toast.warning(
					`${result.summary.failCount} users failed to disconnect`,
				);
			}

			setReason("");
			setConfirmText("");
		} catch (_error) {
			toast.error("Emergency disconnect failed");
		}
	};

	return (
		<div className="space-y-6">
			{/* Warning Banner */}
			<Card className="border-destructive bg-destructive/10">
				<CardContent className="flex items-start gap-4 p-6">
					<AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
					<div>
						<h3 className="font-bold text-lg text-destructive mb-2">
							SUPER ADMIN ONLY
						</h3>
						<p className="text-sm text-muted-foreground">
							These actions are irreversible and affect all users.
							Only use in genuine emergencies:
						</p>
						<ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
							<li>Discord bot token compromised</li>
							<li>Server migration in progress</li>
							<li>Critical security incident</li>
							<li>Coordinated abuse/spam attack</li>
						</ul>
					</div>
				</CardContent>
			</Card>

			{/* Disconnect All */}
			<Card>
				<CardHeader>
					<CardTitle>Emergency Disconnect All Users</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<label
							htmlFor="emergency-reason"
							className="text-sm font-medium"
						>
							Reason (required)
						</label>
						<Textarea
							id="emergency-reason"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Describe the emergency situation..."
							className="mt-2"
							rows={4}
						/>
					</div>

					<div>
						<label
							htmlFor="emergency-confirm"
							className="text-sm font-medium"
						>
							Type "DISCONNECT ALL USERS" to confirm
						</label>
						<Input
							id="emergency-confirm"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder="DISCONNECT ALL USERS"
							className="mt-2 font-mono"
						/>
					</div>

					<Button
						variant="error"
						onClick={handleDisconnectAll}
						loading={disconnectAllMutation.isPending}
						disabled={
							confirmText !== "DISCONNECT ALL USERS" ||
							reason.length < 10 ||
							disconnectAllMutation.isPending
						}
						className="w-full"
					>
						<AlertTriangle className="mr-2 h-4 w-4" />
						Emergency Disconnect All Users
					</Button>

					{disconnectAllMutation.data && (
						<div className="mt-4 p-4 bg-muted rounded-lg">
							<p className="font-medium">Results:</p>
							<ul className="text-sm space-y-1 mt-2">
								<li>
									Total Users:{" "}
									{
										disconnectAllMutation.data.summary
											.totalUsers
									}
								</li>
								<li>
									Successfully Disconnected:{" "}
									{
										disconnectAllMutation.data.summary
											.successCount
									}
								</li>
								<li>
									Failed:{" "}
									{
										disconnectAllMutation.data.summary
											.failCount
									}
								</li>
							</ul>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
