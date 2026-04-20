import { createTestimonial } from "./procedures/create-testimonial";
import { createTestimonialImageUploadUrl } from "./procedures/create-testimonial-image-upload-url";
import { deleteTestimonial } from "./procedures/delete-testimonial";
import { listTestimonials } from "./procedures/list-testimonials";
import { reorderTestimonials } from "./procedures/reorder-testimonials";
import { updateTestimonial } from "./procedures/update-testimonial";

// Follow help center pattern with nested public/admin structure
export const testimonialsRouter = {
	public: {
		list: listTestimonials,
	},
	admin: {
		list: listTestimonials, // Admin can see all (published + unpublished)
		create: createTestimonial,
		update: updateTestimonial,
		delete: deleteTestimonial,
		reorder: reorderTestimonials,
		imageUploadUrl: createTestimonialImageUploadUrl,
	},
};
