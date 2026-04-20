import crypto from "node:crypto";
import { config } from "@repo/config";
import { getSignedUploadUrl } from "@repo/storage";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const createTestimonialImageUploadUrl = adminProcedure
	.route({
		method: "POST",
		path: "/testimonials/image-upload-url",
		tags: ["Testimonials"],
		summary: "Create testimonial image upload URL",
		description:
			"Create a signed upload URL to upload a testimonial avatar image to the storage bucket",
	})
	.input(
		z.object({
			contentType: z.string(),
			fileExtension: z.string(),
		}),
	)
	.handler(async ({ input }) => {
		const imageId = crypto.randomUUID();
		const path = `${imageId}${input.fileExtension}`;
		const signedUploadUrl = await getSignedUploadUrl(path, {
			bucket: config.storage.bucketNames.testimonials,
			contentType: input.contentType,
		});

		return { signedUploadUrl, path };
	});
