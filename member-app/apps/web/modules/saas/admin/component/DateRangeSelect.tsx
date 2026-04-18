"use client";

import { formatDate } from "@saas/admin/lib/subscription-utils";
import { Badge } from "@ui/components/badge";
import { Button } from "@ui/components/button";
import { Calendar } from "@ui/components/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@ui/components/select";
import { useState } from "react";
import { X } from "@/modules/ui/icons";

interface DateRangeSelectProps {
	value: string;
	customLabel?: string | null;
	onChange: (value: string) => void;
	onCustomRangeApply: (start: Date, end: Date, label: string) => void;
	onClear: () => void;
}

export function DateRangeSelect({
	value,
	customLabel,
	onChange,
	onCustomRangeApply,
	onClear,
}: DateRangeSelectProps) {
	const [showCustomPicker, setShowCustomPicker] = useState(false);
	const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
	const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

	const handleSelectChange = (newValue: string) => {
		if (newValue === "custom") {
			setShowCustomPicker(true);
		} else {
			onChange(newValue);
		}
	};

	const handleApplyCustomDates = () => {
		if (customStartDate && customEndDate) {
			// Set start date to beginning of day (00:00:00)
			const startOfDay = new Date(customStartDate);
			startOfDay.setHours(0, 0, 0, 0);

			// Set end date to end of day (23:59:59.999)
			const endOfDay = new Date(customEndDate);
			endOfDay.setHours(23, 59, 59, 999);

			const startFormatted = formatDate(customStartDate.toISOString());
			const endFormatted = formatDate(customEndDate.toISOString());
			const label = `${startFormatted} - ${endFormatted}`;
			onCustomRangeApply(startOfDay, endOfDay, label);
			setShowCustomPicker(false);
			setCustomStartDate(undefined);
			setCustomEndDate(undefined);
		}
	};

	const handleClearCustomDates = () => {
		setCustomStartDate(undefined);
		setCustomEndDate(undefined);
		setShowCustomPicker(false);
	};

	return (
		<>
			<div className="flex items-center gap-2">
				<Select value={value} onValueChange={handleSelectChange}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Select date range" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Time</SelectItem>
						<SelectItem value="today">Today</SelectItem>
						<SelectItem value="yesterday">Yesterday</SelectItem>
						<SelectItem value="last7days">Last 7 Days</SelectItem>
						<SelectItem value="last30days">Last 30 Days</SelectItem>
						<SelectItem value="last90days">Last 90 Days</SelectItem>
						<SelectItem value="thisMonth">This Month</SelectItem>
						<SelectItem value="lastMonth">Last Month</SelectItem>
						<SelectItem value="custom">Custom Range...</SelectItem>
					</SelectContent>
				</Select>
				{customLabel && (
					<Badge className="gap-1">
						{customLabel}
						<X
							className="h-3 w-3 cursor-pointer"
							onClick={onClear}
						/>
					</Badge>
				)}
			</div>

			<Dialog open={showCustomPicker} onOpenChange={setShowCustomPicker}>
				<DialogContent className="max-w-4xl">
					<DialogHeader>
						<DialogTitle>Select Custom Date Range</DialogTitle>
					</DialogHeader>
					<div className="space-y-6 py-4">
						<div className="grid gap-8 md:grid-cols-2">
							<div className="space-y-3">
								<h3 className="text-sm font-semibold">
									Start Date
								</h3>
								<p className="text-xs text-muted-foreground">
									Select the beginning of your date range
								</p>
								<div className="flex justify-center rounded-lg border bg-card p-4 shadow-sm">
									<Calendar
										mode="single"
										selected={customStartDate}
										onSelect={setCustomStartDate}
										disabled={(date: Date) =>
											date > new Date() ||
											(customEndDate
												? date > customEndDate
												: false)
										}
									/>
								</div>
								{customStartDate && (
									<div className="rounded-md bg-muted/50 p-3 text-center">
										<p className="text-sm font-medium">
											{formatDate(
												customStartDate.toISOString(),
											)}
										</p>
									</div>
								)}
							</div>

							<div className="space-y-3">
								<h3 className="text-sm font-semibold">
									End Date
								</h3>
								<p className="text-xs text-muted-foreground">
									Select the end of your date range
								</p>
								<div className="flex justify-center rounded-lg border bg-card p-4 shadow-sm">
									<Calendar
										mode="single"
										selected={customEndDate}
										onSelect={setCustomEndDate}
										disabled={(date: Date) =>
											date > new Date() ||
											(customStartDate
												? date < customStartDate
												: false)
										}
									/>
								</div>
								{customEndDate && (
									<div className="rounded-md bg-muted/50 p-3 text-center">
										<p className="text-sm font-medium">
											{formatDate(
												customEndDate.toISOString(),
											)}
										</p>
									</div>
								)}
							</div>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleClearCustomDates}
						>
							Cancel
						</Button>
						<Button
							onClick={handleApplyCustomDates}
							disabled={!customStartDate || !customEndDate}
						>
							Apply Date Range
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
