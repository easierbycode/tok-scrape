"use client";

import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import { cn } from "@ui/lib";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { AlertCircle, ArrowClockwiseIcon, HouseIcon } from "@/modules/ui/icons";

type RouteErrorVariant = "marketing" | "saas" | "admin";

interface RouteErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
	variant?: RouteErrorVariant;
	homeHref?: string;
}

const variantClasses: Record<RouteErrorVariant, string> = {
	marketing: "min-h-[70vh]",
	saas: "min-h-[60vh]",
	admin: "min-h-[50vh]",
};

export function RouteError({
	error,
	reset,
	variant = "saas",
	homeHref,
}: RouteErrorProps) {
	const t = useTranslations();

	useEffect(() => {
		import("@sentry/nextjs")
			.then((Sentry) => {
				Sentry.captureException(error, {
					tags: {
						component: "RouteError",
						variant,
						digest: error.digest,
					},
				});
			})
			.catch(() => {
				// Sentry not available in this environment — noop.
			});
	}, [error, variant]);

	const resolvedHome = homeHref ?? (variant === "admin" ? "/admin" : "/");

	return (
		<div
			className={cn(
				"flex w-full flex-col items-center justify-center px-6 py-16",
				variantClasses[variant],
			)}
		>
			<Card className="w-full max-w-md shadow-overlay">
				<div className="flex flex-col items-center gap-4 p-8 text-center">
					<div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
						<AlertCircle className="size-6" />
					</div>
					<h1 className="font-serif font-semibold text-2xl tracking-tight">
						{t("common.errors.route.title")}
					</h1>
					<p className="text-muted-foreground text-sm">
						{t("common.errors.route.description")}
					</p>
					{error.digest && (
						<p className="font-mono text-muted-foreground/70 text-xs">
							{t("common.errors.route.reference", {
								digest: error.digest,
							})}
						</p>
					)}
					<div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
						<Button
							type="button"
							onClick={reset}
							className="sm:min-w-[140px]"
						>
							<ArrowClockwiseIcon className="mr-2 size-4" />
							{t("common.errors.route.retry")}
						</Button>
						<Button
							type="button"
							variant="light"
							onClick={() => {
								window.location.href = resolvedHome;
							}}
							className="sm:min-w-[140px]"
						>
							<HouseIcon className="mr-2 size-4" />
							{t("common.errors.route.home")}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}
