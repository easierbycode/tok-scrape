"use client";

import { Button } from "@ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ui/components/dialog";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import type { ReactCropperElement } from "react-cropper";
import Cropper from "react-cropper";

export function CropImageDialog({
	image,
	open,
	onOpenChange,
	onCrop,
}: {
	image: File | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCrop: (croppedImage: Blob | null) => void;
}) {
	const t = useTranslations();
	const cropperRef = useRef<ReactCropperElement>(null);

	const imageSrc = useMemo(
		() => (image ? URL.createObjectURL(image) : null),
		[image],
	);

	useEffect(() => {
		return () => {
			if (imageSrc) {
				URL.revokeObjectURL(imageSrc);
			}
		};
	}, [imageSrc]);

	const getCroppedImage = async () => {
		const cropper = cropperRef.current?.cropper;

		const imageBlob = await new Promise<Blob | null>((resolve) => {
			cropper
				?.getCroppedCanvas({
					maxWidth: 256,
					maxHeight: 256,
				})
				.toBlob(resolve);
		});

		return imageBlob;
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="font-serif font-semibold tracking-tight">
						{t("settings.account.avatar.cropDialog.title")}
					</DialogTitle>
					<DialogDescription>
						{t("settings.account.avatar.cropDialog.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-[60vh] overflow-hidden rounded-lg bg-muted/30 shadow-flat">
					{imageSrc && (
						<Cropper
							src={imageSrc}
							style={{ width: "100%", maxHeight: "60vh" }}
							initialAspectRatio={1}
							aspectRatio={1}
							guides={true}
							ref={cropperRef}
						/>
					)}
				</div>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="light"
						onClick={() => onOpenChange(false)}
					>
						{t("settings.account.avatar.cropDialog.cancel")}
					</Button>
					<Button
						type="button"
						onClick={async () => {
							onCrop(await getCroppedImage());
							onOpenChange(false);
						}}
					>
						{t("settings.save")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
