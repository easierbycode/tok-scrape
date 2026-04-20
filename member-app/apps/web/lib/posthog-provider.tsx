"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { type PropsWithChildren, Suspense, useEffect } from "react";
import { isPostHogCaptureEnabled, POSTHOG_DEFAULT_HOST } from "@/lib/posthog";

function PostHogPageView() {
	const pathname = usePathname();
	const searchParams = useSearchParams();

	useEffect(() => {
		if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
			return;
		}
		const url =
			pathname +
			(searchParams?.toString() ? `?${searchParams.toString()}` : "");
		posthog.capture("$pageview", { $current_url: url });
	}, [pathname, searchParams]);

	return null;
}

export function PostHogProvider({ children }: PropsWithChildren) {
	useEffect(() => {
		if (!isPostHogCaptureEnabled()) {
			return;
		}
		const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
		const host =
			process.env.NEXT_PUBLIC_POSTHOG_HOST ?? POSTHOG_DEFAULT_HOST;
		if (!key) {
			return;
		}

		posthog.init(key, {
			api_host: host,
			person_profiles: "identified_only",
			capture_pageview: false,
		});
	}, []);

	if (!isPostHogCaptureEnabled()) {
		return children;
	}

	return (
		<>
			<Suspense fallback={null}>
				<PostHogPageView />
			</Suspense>
			{children}
		</>
	);
}
