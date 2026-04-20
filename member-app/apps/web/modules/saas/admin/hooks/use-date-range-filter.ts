"use client";

import { useCallback, useState } from "react";

export function useDateRangeFilter() {
	const [dateRange, setDateRange] = useState("all");
	const [customDateLabel, setCustomDateLabel] = useState<string | null>(null);
	const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
	const [customEndDate, setCustomEndDate] = useState<Date | null>(null);

	const handleCustomRangeApply = useCallback(
		(start: Date, end: Date, label: string) => {
			setCustomStartDate(start);
			setCustomEndDate(end);
			setCustomDateLabel(label);
			setDateRange("custom");
		},
		[],
	);

	const clearDateRange = useCallback(() => {
		setDateRange("all");
		setCustomDateLabel(null);
		setCustomStartDate(null);
		setCustomEndDate(null);
	}, []);

	const isWithinDateRange = useCallback(
		(dateString: string): boolean => {
			if (dateRange === "all") {
				return true;
			}

			const itemDate = new Date(dateString);
			const now = new Date();

			if (dateRange === "custom" && customStartDate && customEndDate) {
				return itemDate >= customStartDate && itemDate <= customEndDate;
			}

			// Calculate date ranges
			const today = new Date(
				now.getFullYear(),
				now.getMonth(),
				now.getDate(),
			);
			const endOfToday = new Date(today);
			endOfToday.setHours(23, 59, 59, 999);
			const yesterday = new Date(today);
			yesterday.setDate(yesterday.getDate() - 1);

			switch (dateRange) {
				case "today":
					return itemDate >= today && itemDate <= endOfToday;
				case "yesterday": {
					const endOfYesterday = new Date(yesterday);
					endOfYesterday.setHours(23, 59, 59, 999);
					return itemDate >= yesterday && itemDate <= endOfYesterday;
				}
				case "last7days": {
					const last7Days = new Date(today);
					last7Days.setDate(last7Days.getDate() - 7);
					return itemDate >= last7Days;
				}
				case "last30days": {
					const last30Days = new Date(today);
					last30Days.setDate(last30Days.getDate() - 30);
					return itemDate >= last30Days;
				}
				case "last90days": {
					const last90Days = new Date(today);
					last90Days.setDate(last90Days.getDate() - 90);
					return itemDate >= last90Days;
				}
				case "thisMonth": {
					const startOfMonth = new Date(
						now.getFullYear(),
						now.getMonth(),
						1,
					);
					return itemDate >= startOfMonth;
				}
				case "lastMonth": {
					const startOfLastMonth = new Date(
						now.getFullYear(),
						now.getMonth() - 1,
						1,
					);
					const endOfLastMonth = new Date(
						now.getFullYear(),
						now.getMonth(),
						0,
					);
					endOfLastMonth.setHours(23, 59, 59, 999);
					return (
						itemDate >= startOfLastMonth &&
						itemDate <= endOfLastMonth
					);
				}
				default:
					return true;
			}
		},
		[dateRange, customStartDate, customEndDate],
	);

	return {
		dateRange,
		setDateRange,
		customDateLabel,
		handleCustomRangeApply,
		clearDateRange,
		isWithinDateRange,
	};
}
