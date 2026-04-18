"use client";

import { useEffect, useState } from "react";

export function useDebouncedSearch(initialValue = "", delay = 300) {
	const [searchQuery, setSearchQuery] = useState(initialValue);
	const [debouncedQuery, setDebouncedQuery] = useState(initialValue);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery);
		}, delay);

		return () => clearTimeout(timer);
	}, [searchQuery, delay]);

	return { searchQuery, setSearchQuery, debouncedQuery };
}
