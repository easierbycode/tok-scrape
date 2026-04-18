"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SLOW_THRESHOLD_MS = 8000; // 8 seconds

export function SlowQueryObserver() {
	const queryClient = useQueryClient();
	const activeToastRef = useRef<string | number | null>(null);
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	useEffect(() => {
		const cache = queryClient.getQueryCache();

		const unsubscribe = cache.subscribe((event) => {
			if (!event?.query) {
				return;
			}

			const queryHash = event.query.queryHash;
			const fetchStatus = event.query.state.fetchStatus;

			// Query finished (success or error) -- clear timer and dismiss toast
			if (fetchStatus !== "fetching") {
				const timer = timersRef.current.get(queryHash);
				if (timer) {
					clearTimeout(timer);
					timersRef.current.delete(queryHash);
				}

				if (timersRef.current.size === 0 && activeToastRef.current) {
					toast.dismiss(activeToastRef.current);
					activeToastRef.current = null;
				}
				return;
			}

			// Query started fetching -- set a slow warning timer
			if (
				fetchStatus === "fetching" &&
				!timersRef.current.has(queryHash)
			) {
				const timer = setTimeout(() => {
					// Re-check if still fetching (query might have completed)
					if (event.query.state.fetchStatus === "fetching") {
						if (!activeToastRef.current) {
							activeToastRef.current = toast.loading(
								"Taking longer than usual... Still trying to connect.",
								{ duration: Number.POSITIVE_INFINITY },
							);
						}
					}
					timersRef.current.delete(queryHash);
				}, SLOW_THRESHOLD_MS);

				timersRef.current.set(queryHash, timer);
			}
		});

		return () => {
			unsubscribe();
			for (const timer of timersRef.current.values()) {
				clearTimeout(timer);
			}
			timersRef.current.clear();
		};
	}, [queryClient]);

	return null;
}
