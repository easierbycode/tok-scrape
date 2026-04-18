"use client";

import { RouteError } from "@shared/components/RouteError";

export default function SaasAppError({
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
			homeHref="/app"
		/>
	);
}
