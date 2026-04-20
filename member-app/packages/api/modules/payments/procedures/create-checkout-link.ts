import { ORPCError } from "@orpc/client";
import { type Config, config } from "@repo/config";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import {
	createCheckoutLink as createCheckoutLinkFn,
	getCustomerIdFromEntity,
} from "@repo/payments";
import { z } from "zod";
import { localeMiddleware } from "../../../orpc/middleware/locale-middleware";
import { rateLimitMiddleware } from "../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../orpc/procedures";

export const createCheckoutLink = protectedProcedure
	.use(localeMiddleware)
	.use(rateLimitMiddleware({ limit: 10, windowMs: 60000 }))
	.route({
		method: "POST",
		path: "/payments/create-checkout-link",
		tags: ["Payments"],
		summary: "Create checkout link",
		description:
			"Creates a checkout link for a one-time or subscription product",
	})
	.input(
		z.object({
			type: z.enum(["one-time", "subscription"]),
			productId: z.string(),
			redirectUrl: z.string().optional(),
			allowPromoCodes: z.boolean().optional(),
		}),
	)
	.handler(
		async ({
			input: { productId, redirectUrl, type, allowPromoCodes },
			context: { user },
		}) => {
			const customerId = await getCustomerIdFromEntity({
				userId: user.id,
			});

			const plans = config.payments.plans as Config["payments"]["plans"];

			const plan = Object.entries(plans).find(([_planId, plan]) =>
				plan.prices?.find((price) => price.productId === productId),
			);
			const price = plan?.[1].prices?.find(
				(price) => price.productId === productId,
			);
			const trialPeriodDays =
				price && "trialPeriodDays" in price && (price.trialPeriodDays ?? 0) > 0
					? price.trialPeriodDays
					: undefined;

		const userRecord = await db.user.findUnique({
			where: { id: user.id },
			select: { referredBy: true, referredBySlug: true },
		});
		const referralId = userRecord?.referredBy ?? undefined;
		const affiliateToken = userRecord?.referredBySlug ?? undefined;

		try {
			const checkoutLink = await createCheckoutLinkFn({
				type,
				productId,
				email: user.email,
				name: user.name ?? "",
				redirectUrl,
				userId: user.id,
				trialPeriodDays,
				customerId: customerId ?? undefined,
				referralId,
				affiliateToken,
				allowPromoCodes,
			});

				if (!checkoutLink) {
					throw new ORPCError("INTERNAL_SERVER_ERROR");
				}

				return { checkoutLink };
			} catch (e) {
				logger.error(e);
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}
		},
	);
