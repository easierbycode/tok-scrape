import { createHeroThumbnailUploadUrl } from "./procedures/create-hero-thumbnail-upload-url";
import { getMarketingContent } from "./procedures/get-content";
import { listMarketingFaqs } from "./procedures/list-faqs";
import {
	createBenefit,
	deleteBenefit,
	listAllBenefits,
	listPublishedBenefits,
	reorderBenefits,
	updateBenefit,
} from "./procedures/manage-benefits";
import {
	createFaq,
	deleteFaq,
	listAllFaqs,
	reorderFaqs,
	updateFaq,
} from "./procedures/manage-faqs";
import {
	createPricingPlan,
	deletePricingPlan,
	getActivePromo,
	listAllPricingPlans,
	listPublishedPricingPlans,
	reorderPricingPlans,
	updatePricingPlan,
} from "./procedures/manage-pricing";
import { upsertMarketingContent } from "./procedures/upsert-content";

export const marketingRouter = {
	public: {
		content: getMarketingContent,
		faqs: listMarketingFaqs,
		benefits: listPublishedBenefits,
		pricing: listPublishedPricingPlans,
		promo: getActivePromo,
	},
	admin: {
		content: getMarketingContent,
		upsertContent: upsertMarketingContent,
		heroThumbnailUploadUrl: createHeroThumbnailUploadUrl,
		faqs: {
			list: listAllFaqs,
			create: createFaq,
			update: updateFaq,
			delete: deleteFaq,
			reorder: reorderFaqs,
		},
		benefits: {
			list: listAllBenefits,
			create: createBenefit,
			update: updateBenefit,
			delete: deleteBenefit,
			reorder: reorderBenefits,
		},
		pricing: {
			list: listAllPricingPlans,
			create: createPricingPlan,
			update: updatePricingPlan,
			delete: deletePricingPlan,
			reorder: reorderPricingPlans,
		},
	},
};
