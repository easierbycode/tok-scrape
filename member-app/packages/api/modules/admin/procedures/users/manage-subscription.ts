import { type Config, config } from "@repo/config";
import { db, getPurchasesByUserId } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { changeToGracePeriodRole, resolvePlanRoleId } from "@repo/discord";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import {
	createCheckoutLink as createCheckoutLinkFn,
	getCustomerIdFromEntity,
	getStripeClient,
} from "@repo/payments";
import { resolveSubscriptionProductIdFromPlanKey } from "@repo/payments/lib/helper";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

// Grant free months
export const grantFreeMonths = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/grant-free-months",
		tags: ["Administration"],
		summary: "Grant free months to a user's subscription",
	})
	.input(
		z.object({
			userId: z.string(),
			months: z.number().min(1).max(12),
			reason: z.string().min(10, "Reason must be at least 10 characters"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, months, reason } = input;
		const stripe = getStripeClient();

		// Get user's active subscription purchase
		const purchases = await getPurchasesByUserId(userId);
		const activePurchase = purchases.find(
			(p) =>
				p.status === "active" &&
				p.type === "SUBSCRIPTION" &&
				p.subscriptionId,
		);

		if (!activePurchase || !activePurchase.subscriptionId) {
			throw new Error(
				"User does not have an active subscription to apply free months to",
			);
		}

		// Create 100% off coupon for specified duration
		const couponId = `free_months_${userId}_${Date.now()}`;
		await stripe.coupons.create({
			id: couponId,
			percent_off: 100,
			duration: "repeating",
			duration_in_months: months,
			name: `Free ${months} month(s) - Admin Grant`,
		});

		// Apply coupon to subscription using discounts
		await stripe.subscriptions.update(activePurchase.subscriptionId, {
			discounts: [{ coupon: couponId }],
		});

		const grantTarget = await db.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "GRANT_FREE_MONTHS",
			targetType: "subscription",
			targetId: activePurchase.subscriptionId,
			summary: `Granted ${months} free month(s) to ${grantTarget?.email ?? userId} (subscription ${activePurchase.subscriptionId})`,
			metadata: {
				reason,
				months,
				couponId,
				userId,
			},
		});

		return {
			success: true,
			message: `User will receive ${months} free month(s)`,
		};
	});

// Change subscription plan
export const changePlan = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/change-plan",
		tags: ["Administration"],
		summary: "Change a user's subscription plan",
	})
	.input(
		z.object({
			userId: z.string(),
			newPlan: z.string(),
			applyTiming: z.enum(["immediate", "next_renewal"]),
			reason: z.string().min(10, "Reason must be at least 10 characters"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, newPlan, applyTiming, reason } = input;
		const stripe = getStripeClient();

		// Get user's active subscription purchase
		const purchases = await getPurchasesByUserId(userId);
		const activePurchase = purchases.find(
			(p) =>
				p.status === "active" &&
				p.type === "SUBSCRIPTION" &&
				p.subscriptionId,
		);

		if (!activePurchase || !activePurchase.subscriptionId) {
			throw new Error(
				"User does not have an active subscription to change",
			);
		}

		const plans = config.payments.plans as Config["payments"]["plans"];
		let newPriceId: string | undefined;

		if (newPlan === "pro-monthly") {
			newPriceId = plans.pro.prices?.find(
				(p) => p.type === "recurring" && p.interval === "month",
			)?.productId;
		} else if (newPlan === "pro-yearly") {
			newPriceId = plans.pro.prices?.find(
				(p) => p.type === "recurring" && p.interval === "year",
			)?.productId;
		} else {
			newPriceId = resolveSubscriptionProductIdFromPlanKey(newPlan);
		}

		if (!newPriceId) {
			throw new Error(`Invalid plan: ${newPlan}`);
		}

		// Get current subscription to find the subscription item
		const subscription = await stripe.subscriptions.retrieve(
			activePurchase.subscriptionId,
		);
		const subscriptionItemId = subscription.items.data[0]?.id;

		if (!subscriptionItemId) {
			throw new Error("Subscription has no items");
		}

		// Update subscription with new price
		await stripe.subscriptions.update(activePurchase.subscriptionId, {
			items: [
				{
					id: subscriptionItemId,
					price: newPriceId,
				},
			],
			proration_behavior:
				applyTiming === "immediate" ? "always_invoice" : "none",
		});

		// Update database
		await db.purchase.update({
			where: { id: activePurchase.id },
			data: {
				productId: newPriceId,
			},
		});

		const planChangeUser = await db.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CHANGE_PLAN",
			targetType: "subscription",
			targetId: activePurchase.subscriptionId,
			summary: `Changed plan to ${newPlan} for ${planChangeUser?.email ?? userId} (${applyTiming})`,
			metadata: {
				reason,
				newPlan,
				newPriceId,
				applyTiming,
				userId,
			},
		});

		return {
			success: true,
			message: `Subscription updated to ${newPlan}`,
		};
	});

// Cancel subscription
export const cancelSubscription = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/cancel-subscription",
		tags: ["Administration"],
		summary: "Cancel a user's subscription",
	})
	.input(
		z.object({
			userId: z.string(),
			cancelType: z.enum(["end_of_period", "immediate"]),
			reason: z.string().min(10, "Reason must be at least 10 characters"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, cancelType, reason } = input;
		const stripe = getStripeClient();

		// Get user's active subscription purchase
		const purchases = await getPurchasesByUserId(userId);
		const activePurchase = purchases.find(
			(p) =>
				p.status === "active" &&
				p.type === "SUBSCRIPTION" &&
				p.subscriptionId,
		);

		if (!activePurchase || !activePurchase.subscriptionId) {
			throw new Error(
				"User does not have an active subscription to cancel",
			);
		}

		const subscriptionId = activePurchase.subscriptionId;
		const immediate = cancelType === "immediate";

		// Get purchase record with user info
		const purchase = await db.purchase.findUnique({
			where: { subscriptionId },
			include: { user: true },
		});

		if (!purchase || !purchase.user) {
			throw new Error("Purchase or user not found");
		}

		// Cancel in Stripe
		if (immediate) {
			await stripe.subscriptions.cancel(subscriptionId);
		} else {
			await stripe.subscriptions.update(subscriptionId, {
				cancel_at_period_end: true,
			});
		}

		// Update database
		await db.purchase.update({
			where: { subscriptionId },
			data: {
				status: immediate ? "canceled" : purchase.status,
				cancelAtPeriodEnd: !immediate,
				cancelledAt: immediate ? new Date() : purchase.cancelledAt,
			},
		});

		// Send cancellation email
		if (purchase.user.email) {
			const reactivateUrl = process.env.NEXT_PUBLIC_APP_URL
				? `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`
				: "#";

			await sendEmail({
				to: purchase.user.email,
				templateId: "subscriptionCanceled",
				context: {
					name: purchase.user.name,
					cancelledAt: immediate
						? new Date()
						: purchase.currentPeriodEnd || new Date(),
					reactivateUrl,
				},
			}).catch((error) => {
				logger.error("Failed to send cancellation email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
		}

		// Change Discord role to grace period
		if (purchase.user.discordId) {
			const planRoleId = purchase.user.discordRoleKey
				? resolvePlanRoleId(purchase.user.discordRoleKey)
				: null;
			const result = await changeToGracePeriodRole(
				purchase.user.discordId,
				planRoleId ?? undefined,
			);
			if (!result.success) {
				logger.error("Discord role change failed (cancel)", {
					userId: purchase.userId,
					discordId: purchase.user.discordId,
					error: result.error,
				});
			}
		}

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CANCEL_SUBSCRIPTION",
			targetType: "subscription",
			targetId: subscriptionId,
			summary: immediate
				? `Immediately canceled subscription for ${purchase.user.email}`
				: `Scheduled cancel at period end for ${purchase.user.email}`,
			metadata: {
				reason,
				immediate,
				userId,
			},
		});

		return {
			success: true,
			message:
				cancelType === "end_of_period"
					? "User will retain access until period end"
					: "User access has been terminated",
		};
	});

// Convert manual access to paid subscription
export const convertToPaid = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/convert-to-paid",
		tags: ["Administration"],
		summary:
			"Create checkout link to convert manual access to paid subscription",
	})
	.input(
		z.object({
			userId: z.string(),
			productId: z.string(),
			redirectUrl: z.string().optional(),
			reason: z.string().min(10, "Reason must be at least 10 characters"),
		}),
	)
	.handler(async ({ input, context }) => {
		const { userId, productId, redirectUrl, reason } = input;

		// Get user details
		const user = await db.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Get customer ID if exists
		const customerId = await getCustomerIdFromEntity({ userId });

		// Get plan details from config
		const plans = config.payments.plans as Config["payments"]["plans"];
		const plan = Object.entries(plans).find(([_planId, plan]) =>
			plan.prices?.find((price) => price.productId === productId),
		);
		const price = plan?.[1].prices?.find(
			(price) => price.productId === productId,
		);
		const trialPeriodDays =
			price && "trialPeriodDays" in price
				? price.trialPeriodDays
				: undefined;

		// Create checkout link
		const checkoutLink = await createCheckoutLinkFn({
			type: "subscription",
			productId,
			email: user.email,
			name: user.name ?? "",
			redirectUrl,
			userId,
			trialPeriodDays,
			customerId: customerId ?? undefined,
			referralId: user.referredBy ?? undefined,
			affiliateToken: user.referredBySlug ?? undefined,
		});

		if (!checkoutLink) {
			throw new Error("Failed to create checkout link");
		}

		// Log audit action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "CONVERT_TO_PAID",
			targetType: "user",
			targetId: userId,
			summary: `Created paid checkout for ${user.email} (product ${productId})`,
			metadata: {
				reason,
				productId,
				checkoutLink,
			},
		});

		return { checkoutLink };
	});
