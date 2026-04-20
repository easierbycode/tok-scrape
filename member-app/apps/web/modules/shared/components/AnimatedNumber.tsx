"use client";

import { useAnimatedCount } from "@shared/hooks/use-animated-count";
import { usePrefersReducedMotion } from "@shared/hooks/use-prefers-reduced-motion";
import { cn } from "@ui/lib";

type AnimatedNumberFormat = "integer" | "decimal" | "currency" | "percent";

interface AnimatedNumberProps {
	value: number;
	format?: AnimatedNumberFormat;
	fractionDigits?: number;
	durationMs?: number;
	currency?: string;
	prefix?: string;
	suffix?: string;
	className?: string;
}

function formatValue(
	current: number,
	format: AnimatedNumberFormat,
	fractionDigits: number,
	currency: string,
) {
	if (format === "currency") {
		return `${currency}${current.toLocaleString("en-US", {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		})}`;
	}
	if (format === "percent") {
		return `${current.toFixed(fractionDigits)}%`;
	}
	if (format === "decimal") {
		return current.toLocaleString("en-US", {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: fractionDigits,
		});
	}
	return Math.round(current).toLocaleString("en-US");
}

export function AnimatedNumber({
	value,
	format = "integer",
	fractionDigits,
	durationMs = 900,
	currency = "$",
	prefix,
	suffix,
	className,
}: AnimatedNumberProps) {
	const prefersReducedMotion = usePrefersReducedMotion();
	const current = useAnimatedCount(value, {
		prefersReducedMotion,
		durationMs,
	});

	const digits =
		fractionDigits ??
		(format === "currency" ? 2 : format === "percent" ? 1 : 0);

	const formatted = formatValue(current, format, digits, currency);

	return (
		<span className={cn("tabular-nums", className)}>
			{prefix}
			{formatted}
			{suffix}
		</span>
	);
}
