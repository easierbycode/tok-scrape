import type { RouterClient } from "@orpc/server";
import { adminRouter } from "../modules/admin/router";
import { aiRouter } from "../modules/ai/router";
import { communityRouter } from "../modules/community/router";
import { contactRouter } from "../modules/contact/router";
import { contentRouter } from "../modules/content/router";
import { helpCenterRouter } from "../modules/help-center/router";
import { marketingRouter } from "../modules/marketing/router";
import { newsletterRouter } from "../modules/newsletter/router";
import { organizationsRouter } from "../modules/organizations/router";
import { paymentsRouter } from "../modules/payments/router";
import { testimonialsRouter } from "../modules/testimonials/router";
import { usersRouter } from "../modules/users/router";
import { publicProcedure } from "./procedures";

export const router = publicProcedure.router({
	admin: adminRouter,
	newsletter: newsletterRouter,
	contact: contactRouter,
	organizations: organizationsRouter,
	users: usersRouter,
	payments: paymentsRouter,
	ai: aiRouter,
	content: contentRouter,
	community: communityRouter,
	helpCenter: helpCenterRouter.public,
	testimonials: testimonialsRouter.public,
	marketing: marketingRouter.public,
});

export type ApiRouterClient = RouterClient<typeof router>;
