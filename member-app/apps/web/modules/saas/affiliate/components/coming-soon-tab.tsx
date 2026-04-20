"use client";

import { Button } from "@ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardTitle,
} from "@ui/components/card";
import { Lock } from "@/modules/ui/icons";

interface ComingSoonTabProps {
	title: string;
	description: string;
}

export function ComingSoonTab({ title, description }: ComingSoonTabProps) {
	return (
		<Card className="text-center py-12 sm:py-16">
			<CardContent className="space-y-6">
				<Lock className="mx-auto h-16 w-16 text-muted-foreground/50" />
				<div className="space-y-2">
					<CardTitle className="font-serif font-bold tracking-tight text-2xl sm:text-3xl">
						{title}
					</CardTitle>
					<CardDescription className="text-base sm:text-lg max-w-md mx-auto">
						{description}
					</CardDescription>
				</div>
				<Button variant="outline" disabled className="mt-4">
					Notify Me When Available
				</Button>
			</CardContent>
		</Card>
	);
}
