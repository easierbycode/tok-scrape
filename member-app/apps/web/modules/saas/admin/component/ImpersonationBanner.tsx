"use client";

import { authClient } from "@repo/auth/client";
import { useSession } from "@saas/auth/hooks/use-session";
import { orpcClient } from "@shared/lib/orpc-client";
import { Button } from "@ui/components/button";
import { toast } from "sonner";
import { Shield, X } from "@/modules/ui/icons";

export function ImpersonationBanner() {
	const { session, user } = useSession();

	const isImpersonating = !!(session as any)?.impersonatedBy;

	const handleStopImpersonating = async () => {
		if (!user?.id) {
			toast.error("Unable to stop impersonation: user ID not found");
			return;
		}

		try {
			await orpcClient.admin.users.stopImpersonation({
				impersonatedUserId: user.id,
			});

			await authClient.admin.stopImpersonating();

			toast.success("Exited impersonation");
			window.location.href = "/admin/users";
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to exit impersonation",
			);
		}
	};

	if (!isImpersonating || !user) {
		return null;
	}

	return (
		<div className="fixed top-0 left-0 right-0 z-50 flex h-8 items-center justify-between bg-orange-500/90 px-4 text-xs font-medium text-white shadow-lg">
			<div className="flex items-center gap-2">
				<Shield className="h-3.5 w-3.5" />
				<span>Impersonating: {user.name || user.email}</span>
			</div>
			<Button
				onClick={handleStopImpersonating}
				variant="ghost"
				size="sm"
				className="h-6 px-2 text-xs text-white hover:bg-white/20 hover:text-white"
			>
				Exit
				<X className="ml-1 h-3 w-3" />
			</Button>
		</div>
	);
}
