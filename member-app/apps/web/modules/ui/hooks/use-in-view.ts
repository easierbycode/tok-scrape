"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires once when the element enters the viewport.
 * Returns `isInView: true` after the element crosses the threshold — never goes back to false.
 * Use the returned `ref` on the element you want to observe.
 */
export function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null);
	const [isInView, setIsInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) {
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setIsInView(true);
					observer.disconnect();
				}
			},
			{ threshold },
		);

		observer.observe(el);
		return () => observer.disconnect();
	}, [threshold]);

	return { ref, isInView };
}
