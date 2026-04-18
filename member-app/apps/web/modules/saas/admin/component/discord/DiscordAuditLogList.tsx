"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@ui/components/badge";
import { Card } from "@ui/components/card";
import { EmptyState } from "@ui/components/empty-state";
import { Input } from "@ui/components/input";
import { Skeleton } from "@ui/components/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ui/components/table";
import { useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import {
	CircleCheckIcon,
	CircleXIcon,
	FileText,
	LogOutIcon,
	RefreshCwIcon,
} from "@/modules/ui/icons";

const actionIcons = {
	connected: CircleCheckIcon,
	disconnected: CircleXIcon,
	kicked: LogOutIcon,
	role_changed: RefreshCwIcon,
};

const actionColors = {
	connected: "text-green-600",
	disconnected: "text-gray-600",
	kicked: "text-red-600",
	role_changed: "text-blue-600",
};

export function DiscordAuditLogList() {
	const [searchTerm, setSearchTerm] = useState("");
	const [debouncedSearchTerm] = useDebounceValue(searchTerm, 300);

	const { data, isPending } = useQuery(
		orpc.admin.discord.auditLogs.queryOptions({
			input: {
				searchTerm: debouncedSearchTerm || undefined,
				limit: 100,
			},
		}),
	);

	if (isPending) {
		return (
			<Card className="p-6">
				<Skeleton className="h-64" />
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<div className="mb-4">
				<Input
					placeholder="Search by user email, Discord username, or ID..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableBody>
						{data?.logs.map((log) => {
							const Icon =
								actionIcons[
									log.action as keyof typeof actionIcons
								] || CircleCheckIcon;
							const colorClass =
								actionColors[
									log.action as keyof typeof actionColors
								] || "text-gray-600";

							return (
								<TableRow key={log.id}>
									<TableCell className="w-12">
										<Icon
											className={`size-5 ${colorClass}`}
										/>
									</TableCell>
									<TableCell>
										<div>
											<p className="font-medium">
												{log.user.name}
											</p>
											<p className="text-muted-foreground text-sm">
												{log.user.email}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<div>
											<p className="font-medium">
												{log.discordUsername ||
													"Unknown"}
											</p>
											<p className="font-mono text-muted-foreground text-xs">
												{log.discordId}
											</p>
										</div>
									</TableCell>
									<TableCell>
										<Badge status="info">
											{log.action
												.replace("_", " ")
												.toUpperCase()}
										</Badge>
									</TableCell>
									<TableCell>
										<p className="text-sm">
											{log.reason || "-"}
										</p>
										{log.performedBy && (
											<p className="text-muted-foreground text-xs">
												By admin
											</p>
										)}
									</TableCell>
									<TableCell className="text-right text-muted-foreground text-sm">
										{new Date(
											log.createdAt,
										).toLocaleString()}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>

				{data?.logs.length === 0 && (
					<EmptyState
						icon={<FileText className="size-6" />}
						title="No audit log entries"
						description={
							debouncedSearchTerm
								? "No audit logs match your search. Try a different term."
								: "Discord membership changes will appear here as they happen."
						}
					/>
				)}
			</div>
		</Card>
	);
}
