"use client";

import { RouteError } from "@shared/components/RouteError";

export default function TiktokShopError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<RouteError
			error={error}
			reset={reset}
			variant="saas"
			homeHref="/app/tiktok-shop"
		/>
	);
}
