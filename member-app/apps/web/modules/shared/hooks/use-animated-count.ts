"use client";

import { useEffect, useRef, useState } from "react";

interface UseAnimatedCountOptions {
	active?: boolean;
	prefersReducedMotion?: boolean;
	durationMs?: number;
}

function easeOutCubic(t: number) {
	return 1 - (1 - t) ** 3;
}

/**
 * Animates a numeric value from 0 to `target` once, on first activation.
 *
 * - Runs a single time per hook instance; subsequent target changes do not
 *   re-animate (useful for one-shot dashboard reveals).
 * - If `prefersReducedMotion` is true, the hook immediately returns `target`.
 * - If `active` is false (e.g. waiting for data / in-view), nothing runs yet.
 */
export function useAnimatedCount(
	target: number,
	{
		active = true,
		prefersReducedMotion = false,
		durationMs = 900,
	}: UseAnimatedCountOptions = {},
) {
	const [display, setDisplay] = useState(prefersReducedMotion ? target : 0);
	const startedRef = useRef(false);

	useEffect(() => {
		if (prefersReducedMotion) {
			setDisplay(target);
			return;
		}
		if (!active || startedRef.current) {
			return;
		}
		startedRef.current = true;

		const start = performance.now();
		const from = 0;
		let rafId: number | null = null;

		function tick(now: number) {
			const elapsed = now - start;
			const t = Math.min(1, elapsed / durationMs);
			const eased = easeOutCubic(t);
			setDisplay(from + (target - from) * eased);
			if (t < 1) {
				rafId = requestAnimationFrame(tick);
			} else {
				setDisplay(target);
			}
		}

		rafId = requestAnimationFrame(tick);
		return () => {
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		};
	}, [active, prefersReducedMotion, target, durationMs]);

	return display;
}
