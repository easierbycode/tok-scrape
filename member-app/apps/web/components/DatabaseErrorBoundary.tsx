"use client";

import * as Sentry from "@sentry/nextjs";
import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "@/modules/ui/icons";

interface DatabaseErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: Error, reset: () => void) => ReactNode;
	context?: string; // e.g., "content library", "course page"
}

interface DatabaseErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
	retryCount: number;
}

export class DatabaseErrorBoundary extends Component<
	DatabaseErrorBoundaryProps,
	DatabaseErrorBoundaryState
> {
	constructor(props: DatabaseErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null, retryCount: 0 };
	}

	static getDerivedStateFromError(
		error: Error,
	): Partial<DatabaseErrorBoundaryState> {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		// Report to Sentry
		Sentry.captureException(error, {
			tags: {
				component: "DatabaseErrorBoundary",
				context: this.props.context,
			},
			extra: { componentStack: errorInfo.componentStack },
		});
	}

	reset = () => {
		this.setState((prev) => ({
			hasError: false,
			error: null,
			retryCount: prev.retryCount + 1,
		}));
	};

	render() {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.reset);
			}

			const isDatabaseError =
				this.state.error.message.includes("database") ||
				this.state.error.message.includes("connection") ||
				this.state.error.message.includes("timeout") ||
				this.state.error.message.includes("P2024");

			return (
				<div className="flex min-h-[400px] flex-col items-center justify-center p-8">
					<Alert variant="error" className="max-w-md">
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>
							{isDatabaseError
								? "Having trouble loading content"
								: "Something went wrong"}
						</AlertTitle>
						<AlertDescription className="mt-2">
							{isDatabaseError ? (
								<>
									We're experiencing temporary connectivity
									issues.
									{this.props.context &&
										` Your ${this.props.context} will be available shortly.`}
									{this.state.retryCount > 2 && (
										<p className="mt-2 text-xs">
											Still having issues? Contact support
											at support@lifepreneur.com
										</p>
									)}
								</>
							) : (
								"Please try refreshing the page. If this persists, contact support."
							)}
						</AlertDescription>
					</Alert>
					<Button onClick={this.reset} className="mt-6">
						<RefreshCw className="mr-2 h-4 w-4" />
						Try Again
					</Button>
				</div>
			);
		}
		return this.props.children;
	}
}
