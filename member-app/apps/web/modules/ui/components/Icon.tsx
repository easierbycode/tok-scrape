import type { IconWeight, Icon as PhosphorIcon } from "@phosphor-icons/react";

export type IconType = PhosphorIcon;

export interface IconProps {
	icon: PhosphorIcon;
	size?: number | string;
	weight?: IconWeight;
	color?: string;
	className?: string;
}

export function Icon({
	icon: IconComponent,
	size = 20,
	weight = "bold",
	...props
}: IconProps) {
	return <IconComponent size={size} weight={weight} {...props} />;
}
