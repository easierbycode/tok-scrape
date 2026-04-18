"use client";

import { logger } from "@repo/logs";
import * as React from "react";

// CSV Export utility (shared across tabs)
export function exportToCSV(data: any[], filename: string) {
	if (data.length === 0) {
		logger.error("No data to export");
		return;
	}

	const headers = Object.keys(data[0]);
	const csvContent = [
		headers.join(","),
		...data.map((row) =>
			headers
				.map((header) => {
					const value = row[header];
					return typeof value === "string" && value.includes(",")
						? `"${value.replace(/"/g, '""')}"`
						: value;
				})
				.join(","),
		),
	].join("\n");

	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");
	const url = URL.createObjectURL(blob);
	link.setAttribute("href", url);
	link.setAttribute(
		"download",
		`${filename}-${new Date().toISOString().split("T")[0]}.csv`,
	);
	link.style.visibility = "hidden";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

// Social sharing utility
export function shareToSocial(
	platform: string,
	url: string,
	text = "Join Lifepreneur and grow your business!",
) {
	let shareUrl = "";

	switch (platform) {
		case "twitter":
			shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
			break;
		case "linkedin":
			shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
			break;
		case "facebook":
			shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
			break;
		case "email":
			shareUrl = `mailto:?subject=${encodeURIComponent("Check out Lifepreneur")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;
			break;
	}

	if (shareUrl) {
		window.open(shareUrl, "_blank", "width=600,height=400");
	}
}

// Status badge utility
export function getStatusBadge(status: string) {
	const statusConfig: Record<
		string,
		{ bg: string; text: string; label: string }
	> = {
		paid: { bg: "bg-muted", text: "text-muted-foreground", label: "Paid" },
		due: { bg: "bg-green-500/20", text: "text-green-600", label: "Due" },
		pending: {
			bg: "bg-yellow-500/20",
			text: "text-yellow-500",
			label: "Pending",
		},
		completed: {
			bg: "bg-green-500/10",
			text: "text-green-500",
			label: "Completed",
		},
		processing: {
			bg: "bg-blue-500/10",
			text: "text-blue-500",
			label: "Processing",
		},
		rejected: {
			bg: "bg-red-500/10",
			text: "text-red-500",
			label: "Rejected",
		},
		visitor: {
			bg: "bg-muted",
			text: "text-muted-foreground",
			label: "Visitor",
		},
		lead: {
			bg: "bg-yellow-500/20",
			text: "text-yellow-600",
			label: "Lead",
		},
		conversion: {
			bg: "bg-green-500/20",
			text: "text-green-500",
			label: "Conversion",
		},
	};

	const config = statusConfig[status];
	if (!config) {
		return null;
	}

	return React.createElement(
		"span",
		{
			className: `px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`,
		},
		config.label,
	);
}
