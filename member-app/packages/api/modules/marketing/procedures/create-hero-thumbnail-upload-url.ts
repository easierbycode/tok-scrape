import crypto from "node:crypto";
import { config } from "@repo/config";
import { getSignedUploadUrl } from "@repo/storage";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const createHeroThumbnailUploadUrl = adminProcedure
	.route({
		method: "POST",
		path: "/marketing/hero-thumbnail-upload-url",
		tags: ["Marketing"],
		summary: "Create hero thumbnail upload URL",
		description:
			"Create a signed upload URL to upload the homepage hero thumbnail image to storage",
	})
	.input(
		z.object({
			contentType: z.string(),
			fileExtension: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const imageId = crypto.randomUUID();
		const path = `hero/${imageId}${input.fileExtension}`;
		const signedUploadUrl = await getSignedUploadUrl(path, {
			bucket: config.storage.bucketNames.marketing,
			contentType: input.contentType,
		});

		return { signedUploadUrl, path };
	});
