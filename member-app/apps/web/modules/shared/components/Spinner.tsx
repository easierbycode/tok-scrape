import { cn } from "@ui/lib";
import { Loader2Icon } from "@/modules/ui/icons";

export function Spinner({ className }: { className?: string }) {
	return (
		<Loader2Icon
			className={cn("size-4 animate-spin text-primary", className)}
		/>
	);
}
