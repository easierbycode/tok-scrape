"use client";

import { Button } from "@ui/components/button";
import { Card } from "@ui/components/card";
import Link from "next/link";
import { ArrowRight, BookOpen, Folder, HelpCircle } from "@/modules/ui/icons";

export default function HelpCenterAdminPage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Help Center Management</h1>
				<p className="text-muted-foreground mt-2">
					Manage help center categories and articles
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<Card className="p-6">
					<div className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<div className="rounded-lg bg-primary/10 p-3">
								<Folder className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h2 className="text-xl font-semibold">
									Categories
								</h2>
								<p className="text-muted-foreground mt-1">
									Manage help center categories and their
									order
								</p>
							</div>
						</div>
					</div>
					<Button asChild className="mt-4 w-full">
						<Link href="/admin/help-center/categories">
							Manage Categories
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</Card>

				<Card className="p-6">
					<div className="flex items-start justify-between">
						<div className="flex items-start gap-4">
							<div className="rounded-lg bg-primary/10 p-3">
								<BookOpen className="h-6 w-6 text-primary" />
							</div>
							<div>
								<h2 className="text-xl font-semibold">
									Articles
								</h2>
								<p className="text-muted-foreground mt-1">
									Create and manage help center articles
								</p>
							</div>
						</div>
					</div>
					<Button asChild className="mt-4 w-full">
						<Link href="/admin/help-center/articles">
							Manage Articles
							<ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</Card>
			</div>

			<Card className="p-6">
				<div className="flex items-start gap-4">
					<HelpCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
					<div>
						<h3 className="font-semibold">
							View Public Help Center
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							See how your help center looks to users
						</p>
						<Button asChild variant="outline" className="mt-3">
							<Link href="/helpcenter" target="_blank">
								Open Help Center
								<ArrowRight className="ml-2 h-4 w-4" />
							</Link>
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}
