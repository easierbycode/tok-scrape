"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

/**
 * Adds a subtle 3D perspective tilt effect that follows the mouse cursor.
 * Only activates on pointer/hover-capable devices — touch screens are unaffected.
 * Attach `ref` to the element you want to tilt and spread `style` onto it.
 */
export function useCardTilt(maxDeg = 8) {
	const ref = useRef<HTMLDivElement>(null);
	const [style, setStyle] = useState<React.CSSProperties>({});

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		if (!window.matchMedia("(hover: hover)").matches) {
			return;
		}

		const reducedMotionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		if (reducedMotionQuery.matches) {
			return;
		}

		const el = ref.current;
		if (!el) {
			return;
		}

		const handleMouseMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const rotateX =
				((e.clientY - rect.top) / rect.height - 0.5) * -maxDeg * 2;
			const rotateY =
				((e.clientX - rect.left) / rect.width - 0.5) * maxDeg * 2;
			setStyle({
				transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
				transition: "transform 0.1s ease-out",
			});
		};

		const handleMouseLeave = () => {
			setStyle({
				transform:
					"perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
				transition: "transform 0.5s ease-out",
			});
		};

		el.addEventListener("mousemove", handleMouseMove);
		el.addEventListener("mouseleave", handleMouseLeave);

		return () => {
			el.removeEventListener("mousemove", handleMouseMove);
			el.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [maxDeg]);

	return { ref, style };
}
