"use client";

import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { Component, type ReactNode } from "react";
import { AlertCircle } from "@/modules/ui/icons";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	reset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError && this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.reset);
			}
			return (
				<PageErrorBoundary
					error={this.state.error}
					reset={this.reset}
				/>
			);
		}
		return this.props.children;
	}
}

export function PageErrorBoundary({
	error: _error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[400px] p-8">
			<Alert variant="error" className="max-w-md">
				<AlertCircle className="h-4 w-4" />
				<AlertTitle>Something went wrong</AlertTitle>
				<AlertDescription className="mt-2">
					We're having trouble loading this page. Please try again.
				</AlertDescription>
			</Alert>
			<Button onClick={reset} className="mt-6">
				Try Again
			</Button>
		</div>
	);
}
