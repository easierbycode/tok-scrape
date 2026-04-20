import { Slot, Slottable } from "@radix-ui/react-slot";
import { Spinner } from "@shared/components/Spinner";
import { cn } from "@ui/lib";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

const buttonVariants = cva(
	"flex items-center justify-center border font-medium enabled:cursor-pointer transition-colors active:opacity-80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&>svg]:mr-1.5 [&>svg]:opacity-60 [&>svg+svg]:hidden",
	{
		variants: {
			variant: {
				primary:
					"border-transparent bg-primary text-primary-foreground shadow-[inset_0_0.5px_0_0_rgba(255,255,255,0.25),inset_0_0_0_0.5px_rgba(0,0,0,0.2),0_1px_2px_0_rgba(0,0,0,0.08)] hover:bg-primary/95",
				error: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border-secondary/15 bg-transparent text-secondary hover:bg-secondary/10 hover:text-primary dark:border-foreground/25 dark:text-foreground dark:hover:bg-foreground/10 dark:hover:text-primary",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
				light: "border-transparent bg-secondary/5 text-foreground hover:bg-secondary/10 hover:text-primary",
				ghost: "border-transparent text-primary hover:bg-primary/10 hover:text-primary",
				link: "border-transparent text-primary underline-offset-4 hover:underline",
			},
			size: {
				md: "h-9 rounded-md px-4 text-sm",
				sm: "h-8 rounded-md px-3 text-xs",
				lg: "h-11 rounded-md px-6 text-base",
				icon: "size-9 rounded-md [&>svg]:m-0 [&>svg]:opacity-100 relative after:absolute after:-inset-1 after:lg:hidden",
			},
		},
		defaultVariants: {
			variant: "secondary",
			size: "md",
		},
	},
);

export type ButtonProps = {
	asChild?: boolean;
	loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			children,
			variant,
			size,
			asChild = false,
			loading,
			disabled,
			...props
		},
		ref,
	) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				ref={ref}
				className={cn(buttonVariants({ variant, size, className }))}
				disabled={disabled || loading}
				{...props}
			>
				{loading && <Spinner className="mr-1.5 size-4 text-inherit" />}
				<Slottable>{children}</Slottable>
			</Comp>
		);
	},
);

Button.displayName = "Button";

export { Button, buttonVariants };
