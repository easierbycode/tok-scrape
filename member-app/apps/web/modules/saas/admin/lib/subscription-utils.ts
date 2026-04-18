/**
 * Utility functions for subscription management
 */

export function formatCurrency(amount: number): string {
	return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a dollar amount with no decimals and thousands commas.
 * Floors to nearest dollar (e.g. $79,323).
 */
export function formatCurrencyRounded(amount: number): string {
	return `$${Math.floor(amount).toLocaleString("en-US")}`;
}

export function formatDate(dateString: string | Date): string {
	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatRelativeTime(dateString: string | Date): string {
	const date =
		typeof dateString === "string" ? new Date(dateString) : dateString;
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);
	const diffMonths = Math.floor(diffDays / 30);
	const diffYears = Math.floor(diffDays / 365);

	if (diffMins < 1) {
		return "Just now";
	}
	if (diffMins < 60) {
		return `${diffMins}m ago`;
	}
	if (diffHours < 24) {
		return `${diffHours}h ago`;
	}
	if (diffDays === 0) {
		return "Today";
	}
	if (diffDays === 1) {
		return "Yesterday";
	}
	if (diffDays < 7) {
		return `${diffDays} days ago`;
	}
	if (diffDays < 30) {
		return `${Math.floor(diffDays / 7)} weeks ago`;
	}
	if (diffMonths < 12) {
		return `${diffMonths} months ago`;
	}
	return `${diffYears} years ago`;
}

export function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function exportToCSV<T>(
	data: T[],
	headers: string[],
	mapFn: (item: T) => (string | number)[],
	filename: string,
): void {
	const csvRows = [
		headers.join(","),
		...data.map((item) => {
			const row = mapFn(item);
			return row
				.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
				.join(",");
		}),
	];

	const csv = csvRows.join("\n");
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${filename}.csv`;
	a.click();
	window.URL.revokeObjectURL(url);
}
