"use client";

import { Button } from "@ui/components/button";
import { Card, CardContent } from "@ui/components/card";
import Link from "next/link";
import { Monitor } from "@/modules/ui/icons";

interface ViewOnDesktopProps {
	title: string;
	description?: string;
}

export function ViewOnDesktop({ title, description }: ViewOnDesktopProps) {
	return (
		<div className="flex items-center justify-center min-h-[60vh] p-6">
			<Card className="max-w-md w-full">
				<CardContent className="pt-6 pb-6 text-center space-y-4">
					<div className="flex justify-center">
						<div className="rounded-full bg-primary/10 p-4">
							<Monitor className="h-12 w-12 text-primary" />
						</div>
					</div>
					<div className="space-y-2">
						<h2 className="text-2xl font-bold tracking-tight">
							{title}
						</h2>
						{description && (
							<p className="text-sm text-muted-foreground text-balance">
								{description}
							</p>
						)}
					</div>
					<div className="pt-2">
						<p className="text-lg font-medium text-muted-foreground">
							Please view on desktop
						</p>
						<p className="text-xs text-muted-foreground mt-2">
							This section requires a larger screen for optimal
							data visualization and management
						</p>
					</div>
					<Link href="/admin">
						<Button className="w-full mt-4">
							Back to Admin Dashboard
						</Button>
					</Link>
				</CardContent>
			</Card>
		</div>
	);
}
