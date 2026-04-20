"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@ui/components/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@ui/components/drawer";
import { useIsMobile } from "@ui/hooks/use-mobile";
import * as React from "react";

interface ResponsiveDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	children: React.ReactNode;
}

function ResponsiveDialog({
	open,
	onOpenChange,
	children,
}: ResponsiveDialogProps) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				{children}
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{children}
		</Dialog>
	);
}

function ResponsiveDialogTrigger({
	children,
	...props
}: React.ComponentProps<typeof DialogTrigger>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return <DrawerTrigger {...props}>{children}</DrawerTrigger>;
	}

	return <DialogTrigger {...props}>{children}</DialogTrigger>;
}

function ResponsiveDialogContent({
	children,
	className,
	...props
}: React.ComponentProps<typeof DialogContent>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return <DrawerContent className={className}>{children}</DrawerContent>;
	}

	return (
		<DialogContent className={className} {...props}>
			{children}
		</DialogContent>
	);
}

function ResponsiveDialogHeader({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<DrawerHeader className={className} {...props}>
				{children}
			</DrawerHeader>
		);
	}

	return (
		<DialogHeader className={className} {...props}>
			{children}
		</DialogHeader>
	);
}

function ResponsiveDialogTitle({
	children,
	className,
	...props
}: React.ComponentProps<typeof DialogTitle>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<DrawerTitle className={className} {...props}>
				{children}
			</DrawerTitle>
		);
	}

	return (
		<DialogTitle className={className} {...props}>
			{children}
		</DialogTitle>
	);
}

function ResponsiveDialogDescription({
	children,
	className,
	...props
}: React.ComponentProps<typeof DialogDescription>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<DrawerDescription className={className} {...props}>
				{children}
			</DrawerDescription>
		);
	}

	return (
		<DialogDescription className={className} {...props}>
			{children}
		</DialogDescription>
	);
}

function ResponsiveDialogFooter({
	children,
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<DrawerFooter className={className} {...props}>
				{children}
			</DrawerFooter>
		);
	}

	return (
		<DialogFooter className={className} {...props}>
			{children}
		</DialogFooter>
	);
}

function ResponsiveDialogClose({
	children,
	...props
}: React.ComponentProps<typeof DrawerClose>) {
	const isMobile = useIsMobile();

	if (isMobile) {
		return <DrawerClose {...props}>{children}</DrawerClose>;
	}

	return null;
}

export {
	ResponsiveDialog,
	ResponsiveDialogClose,
	ResponsiveDialogContent,
	ResponsiveDialogDescription,
	ResponsiveDialogFooter,
	ResponsiveDialogHeader,
	ResponsiveDialogTitle,
	ResponsiveDialogTrigger,
};
