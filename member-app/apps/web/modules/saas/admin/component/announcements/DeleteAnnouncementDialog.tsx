"use client";

import type { Announcement } from "@repo/api/modules/admin/types";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@ui/components/alert-dialog";
import { toast } from "sonner";

interface DeleteAnnouncementDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	announcement: Announcement;
	onSuccess?: () => void;
}

export function DeleteAnnouncementDialog({
	open,
	onOpenChange,
	announcement,
	onSuccess,
}: DeleteAnnouncementDialogProps) {
	const queryClient = useQueryClient();
	const deleteMutation = useMutation(
		orpc.admin.announcements.delete.mutationOptions(),
	);

	const handleDelete = async () => {
		const toastId = toast.loading("Deleting announcement...");

		try {
			await deleteMutation.mutateAsync({ id: announcement.id });

			queryClient.invalidateQueries({
				queryKey: orpc.admin.announcements.list.key(),
			});

			toast.success("Announcement deleted successfully", { id: toastId });
			onOpenChange(false);
			onSuccess?.();
		} catch (error: any) {
			toast.error(`Failed to delete: ${error.message}`, { id: toastId });
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete the announcement "
						{announcement.title}". This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={deleteMutation.isPending}
						className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
					>
						{deleteMutation.isPending ? "Deleting..." : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
