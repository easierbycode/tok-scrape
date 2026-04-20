"use client";

import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Download } from "@/modules/ui/icons";

interface User {
	id: string;
	name: string;
	email: string;
}

interface ExportUserDataDialogProps {
	user: User | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ExportUserDataDialog({
	user,
	open,
	onOpenChange,
}: ExportUserDataDialogProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleExport = async () => {
		if (!user) {
			return;
		}

		setIsLoading(true);
		const toastId = toast.loading("Exporting user data...");

		try {
			const data = await orpcClient.admin.users.exportUserData({
				userId: user.id,
			});

			const blob = new Blob([JSON.stringify(data, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `user-data-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);

			toast.success("User data exported successfully", { id: toastId });
			onOpenChange(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to export user data",
				{ id: toastId },
			);
		} finally {
			setIsLoading(false);
		}
	};

	if (!user) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Download className="h-5 w-5" />
						Export User Data
					</DialogTitle>
					<DialogDescription>
						Download all data for {user.name} ({user.email}) as
						JSON. GDPR Right to Data Portability.
					</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button onClick={handleExport} disabled={isLoading}>
						{isLoading ? "Exporting..." : "Download JSON"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
