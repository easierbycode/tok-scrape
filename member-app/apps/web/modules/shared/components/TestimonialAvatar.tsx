import { config } from "@repo/config";
import { Avatar, AvatarFallback } from "@ui/components/avatar";
import { cn } from "@ui/lib";
import Image from "next/image";
import { useMemo } from "react";

export const TestimonialAvatar = ({
	name,
	avatarUrl,
	className,
	ref,
}: React.ComponentProps<typeof Avatar> & {
	name: string;
	avatarUrl?: string | null;
	className?: string;
}) => {
	const initials = useMemo(
		() =>
			name
				.split(" ")
				.slice(0, 2)
				.map((n) => n[0])
				.join(""),
		[name],
	);

	const avatarSrc = useMemo(
		() =>
			avatarUrl
				? avatarUrl.startsWith("http")
					? avatarUrl
					: `/image-proxy/${config.storage.bucketNames.testimonials}/${avatarUrl}`
				: undefined,
		[avatarUrl],
	);

	return (
		<Avatar ref={ref} className={className}>
			{avatarSrc ? (
				<Image
					src={avatarSrc}
					alt={name}
					fill
					sizes="40px"
					className={cn("object-cover rounded-sm")}
					loading="lazy"
					unoptimized
				/>
			) : (
				<AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-foreground font-semibold">
					{initials}
				</AvatarFallback>
			)}
		</Avatar>
	);
};

TestimonialAvatar.displayName = "TestimonialAvatar";
