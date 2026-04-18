"use client";

import { Input } from "@ui/components/input";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Search } from "@/modules/ui/icons";

export function HelpCenterSearch() {
	const router = useRouter();
	const [query, setQuery] = useState("");

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (query.trim()) {
			router.push(
				`/helpcenter/search?q=${encodeURIComponent(query.trim())}`,
			);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
			<div className="relative">
				<Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
				<Input
					type="search"
					placeholder="Search for articles..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					className="pl-8 sm:pl-10 h-10 sm:h-12 text-sm sm:text-base"
				/>
			</div>
		</form>
	);
}
