import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { getStripeClient } from "@repo/payments";
import { logger } from "@repo/logs";
import { adminProcedure } from "../../../../orpc/procedures";

export const syncStripe = adminProcedure
	.route({
		method: "POST",
		path: "/admin/subscriptions/sync-stripe",
		tags: ["Administration"],
		summary: "Manually sync subscription data from Stripe",
	})
	.handler(async ({ context }) => {
		const stripe = getStripeClient();

		logger.info("Starting manual Stripe subscription sync");

		// Get all active purchases with subscription IDs
		const purchases = await db.purchase.findMany({
			where: {
				status: { in: ["active", "trialing", "past_due"] },
				subscriptionId: { not: null },
				type: "SUBSCRIPTION",
			},
		});

		logger.info(`Found ${purchases.length} subscriptions to sync`);

		// Debug: Log all found purchases
		for (const p of purchases) {
			logger.info("Found purchase to sync", {
				id: p.id,
				subscriptionId: p.subscriptionId,
				status: p.status,
				type: p.type,
				cachedAmount: p.cachedAmount,
				cachedCouponId: p.cachedCouponId,
			});
		}

		let synced = 0;
		let errors = 0;

		// Process in batches of 10 to avoid rate limits
		for (let i = 0; i < purchases.length; i += 10) {
			const batch = purchases.slice(i, i + 10);

			await Promise.all(
				batch.map(async (purchase) => {
					try {
						if (!purchase.subscriptionId) return;

						// Fetch subscription from Stripe with expanded discount data
						// Cast to any to handle Stripe SDK type variations
						const subscriptionResponse = await stripe.subscriptions.retrieve(
							purchase.subscriptionId,
							{
								expand: ["discount.coupon", "discounts.coupon"],
							},
						);
						const subscription = subscriptionResponse as any;

						// Check for period_end in multiple locations:
						// 1. Top-level (older API)
						// 2. In subscription items (newer API / Flexible billing)
						// 3. In the subscription's billing_cycle_anchor + interval
						const subscriptionItem = subscription.items?.data?.[0];
						
						// Log all item keys to find period_end location
						logger.info("Subscription item keys", {
							itemKeys: subscriptionItem ? Object.keys(subscriptionItem).join(", ") : "no item",
							itemPlan: subscriptionItem?.plan ? Object.keys(subscriptionItem.plan).join(", ") : "no plan",
						});
						
						// Try multiple locations for period_end
						const periodEnd = subscription.current_period_end 
							|| subscription.currentPeriodEnd
							|| subscriptionItem?.current_period_end
							|| subscriptionItem?.currentPeriodEnd
							|| subscriptionItem?.billing_thresholds?.current_period_end;
						
						logger.info("Stripe subscription data", {
							subscriptionId: purchase.subscriptionId,
							status: subscription.status,
							periodEnd,
							billingMode: subscription.billing_mode,
							billingCycleAnchor: subscription.billing_cycle_anchor,
							startDate: subscription.start_date,
							discount: subscription.discount?.id,
							discountsLength: subscription.discounts?.length,
						});
						
						// Also fetch the latest invoice to check actual amount charged
						// This handles "once" duration coupons that only apply to first invoice
						// For Flexible billing: period info is on invoice line items, not subscription
						// See: https://docs.stripe.com/billing/subscriptions/billing-mode
						const invoices = await stripe.invoices.list({
							subscription: purchase.subscriptionId,
							limit: 1,
							expand: ["data.lines", "data.discounts.coupon"],
						});
						const latestInvoice = invoices.data[0] as any;
						
						// Try to get period_end from invoice if not on subscription
						const invoiceLineItem = latestInvoice?.lines?.data?.[0];
						const invoicePeriodEnd = invoiceLineItem?.period?.end 
							|| latestInvoice?.period_end;
						const finalPeriodEnd = periodEnd || invoicePeriodEnd;
						
						// Log invoice line item structure
						logger.info("Invoice line item structure", {
							lineItemKeys: invoiceLineItem ? Object.keys(invoiceLineItem).join(", ") : "no line item",
							periodObject: invoiceLineItem?.period,
							periodEnd: invoiceLineItem?.period?.end,
						});
						
						logger.info("Latest invoice data", {
							invoiceId: latestInvoice?.id,
							total: latestInvoice?.total,
							subtotal: latestInvoice?.subtotal,
							invoicePeriodEnd,
							finalPeriodEnd,
							hasDiscount: !!latestInvoice?.discount,
							discountsExpanded: latestInvoice?.discounts?.length,
							totalDiscountAmounts: latestInvoice?.total_discount_amounts,
						});

						const item = subscription.items?.data?.[0];
						if (!item) return;
						const price = item.price;

						// Calculate actual amount after discounts
						let amount = price.unit_amount || 0;
						let discountPercent = 0;
						let couponId: string | null = null;
						let couponName: string | null = null;

						// Check for discount - multiple sources:
						// 1. subscription.discount (recurring discounts)
						// 2. subscription.discounts array (newer API)
						// 3. Latest invoice total (for "once" duration coupons that are already consumed)
						
						const singleDiscount = subscription.discount;
						const arrayDiscount = subscription.discounts?.[0];
						const discountData = singleDiscount || arrayDiscount;

						if (discountData && typeof discountData !== "string") {
							// Recurring discount found on subscription
							const coupon = discountData.coupon;
							if (coupon && typeof coupon !== "string") {
								couponId = coupon.id;
								couponName = coupon.name || null;
								if (coupon.percent_off) {
									discountPercent = coupon.percent_off;
									amount = amount * (1 - discountPercent / 100);
								} else if (coupon.amount_off) {
									amount = Math.max(0, amount - coupon.amount_off);
								}
								logger.info("Used subscription-level discount", { couponId, couponName, discountPercent });
							} else if (typeof coupon === "string") {
								couponId = coupon;
							}
						} else if (latestInvoice) {
							// No subscription-level discount - check if invoice shows a discount was applied
							// This handles "once" duration coupons
							const invoiceTotal = latestInvoice.total ?? latestInvoice.amount_paid ?? 0;
							const invoiceSubtotal = latestInvoice.subtotal ?? amount;
							
							// Check for discount in invoice
							const invoiceDiscount = latestInvoice.discount;
							const invoiceDiscountAmounts = latestInvoice.total_discount_amounts;
							
							if (invoiceDiscount && typeof invoiceDiscount !== "string" && invoiceDiscount.coupon) {
								// Found discount info on invoice
								const coupon = invoiceDiscount.coupon;
								if (typeof coupon !== "string") {
									couponId = coupon.id;
									couponName = coupon.name || null;
									if (coupon.percent_off) {
										discountPercent = coupon.percent_off;
									}
								} else {
									couponId = coupon;
								}
								// Use the actual invoice total as the amount
								amount = invoiceTotal;
								logger.info("Used invoice-level discount", { couponId, couponName, invoiceTotal });
							} else if (invoiceDiscountAmounts && invoiceDiscountAmounts.length > 0) {
								// Discount amount info available
								const discountAmount = invoiceDiscountAmounts[0]?.amount || 0;
								if (discountAmount > 0) {
									amount = invoiceTotal;
									// Try to get coupon ID from discount amounts
									const discountId = invoiceDiscountAmounts[0]?.discount;
									if (discountId && typeof discountId === "string") {
										couponId = discountId;
									}
									logger.info("Used invoice discount amounts", { discountAmount, invoiceTotal });
								}
							} else if (invoiceSubtotal > 0 && invoiceTotal === 0) {
								// Subtotal > 0 but total = 0 means 100% discount was applied
								amount = 0;
								discountPercent = 100;
								logger.info("Detected 100% discount from invoice (subtotal vs total)", { 
									invoiceSubtotal, 
									invoiceTotal 
								});
							}
						}
						
						// If we have a coupon/discount ID but no name, try to fetch it from Stripe
						if (couponId && !couponName) {
							try {
								// Check if it's a discount ID (di_...) or coupon ID
								if (couponId.startsWith("di_")) {
									// It's a discount ID - try to get coupon from expanded invoice discounts
									const invoiceDiscounts = latestInvoice?.discounts;
									logger.info("Checking invoice discounts for coupon", { 
										discountsCount: invoiceDiscounts?.length,
										discountsType: typeof invoiceDiscounts,
										firstDiscount: invoiceDiscounts?.[0] ? JSON.stringify(invoiceDiscounts[0]).substring(0, 200) : null,
									});
									
									if (Array.isArray(invoiceDiscounts)) {
										for (const disc of invoiceDiscounts) {
											if (disc && typeof disc !== "string" && disc.coupon) {
												const coupon = disc.coupon;
												if (typeof coupon !== "string") {
													couponName = coupon.name || null;
													couponId = coupon.id; // Update to actual coupon ID
													logger.info("Got coupon from expanded invoice discounts", { couponId, couponName });
													break;
												}
											}
										}
									}
									
									// If still no name, try invoice line item discounts
									if (!couponName) {
										const lineDiscounts = latestInvoice?.lines?.data?.[0]?.discounts;
										if (Array.isArray(lineDiscounts)) {
											for (const disc of lineDiscounts) {
												if (disc && typeof disc !== "string" && disc.coupon) {
													const coupon = disc.coupon;
													if (typeof coupon !== "string") {
														couponName = coupon.name || null;
														couponId = coupon.id;
														logger.info("Got coupon from line item discounts", { couponId, couponName });
														break;
													}
												}
											}
										}
									}
									
									// If still no name, try direct coupon fetch using the coupon ID pattern
									if (!couponName) {
										// The discount ID format is di_xxx, but we need the coupon ID
										// Try to extract from total_discount_amounts or fetch the discount
										logger.info("Trying to get coupon info from discount object");
									}
								} else {
									// It's a coupon ID - fetch directly
									const couponData = await stripe.coupons.retrieve(couponId);
									couponName = couponData.name || null;
									logger.info("Fetched coupon name from Stripe", { couponId, couponName });
								}
							} catch (e) {
								logger.warn("Failed to fetch coupon/discount details", { couponId, error: e instanceof Error ? e.message : String(e) });
							}
						}

						logger.info("Final calculated values", {
							amount,
							discountPercent,
							couponId,
							interval: price.recurring?.interval,
						});

						// Get interval
						const interval = price.recurring?.interval || "month";

						// Update purchase with cached Stripe data
						await db.purchase.update({
							where: { id: purchase.id },
							data: {
								cachedAmount: Math.round(amount),
								cachedInterval: interval,
								cachedCouponId: couponId,
								cachedCouponName: couponName,
								cachedDiscountPercent: discountPercent > 0 ? discountPercent : null,
								stripeSyncedAt: new Date(),
								// Also update status and currentPeriodEnd from Stripe
								status: subscription.status,
								currentPeriodEnd: finalPeriodEnd
									? new Date(finalPeriodEnd * 1000)
									: null,
							},
						});
						
						logger.info("Updated purchase", {
							purchaseId: purchase.id,
							savedAmount: Math.round(amount),
							savedCouponId: couponId,
							savedCouponName: couponName,
							savedPeriodEnd: finalPeriodEnd ? new Date(finalPeriodEnd * 1000) : null,
						});

						synced++;
					} catch (error) {
						logger.error("Failed to sync subscription", {
							purchaseId: purchase.id,
							subscriptionId: purchase.subscriptionId,
							error:
								error instanceof Error ? error.message : String(error),
						});
						errors++;
					}
				}),
			);

			// Small delay between batches to respect rate limits
			if (i + 10 < purchases.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		logger.info("Manual Stripe subscription sync complete", {
			total: purchases.length,
			synced,
			errors,
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYNC_STRIPE",
			targetType: "subscription",
			targetId: "manual-stripe-sync",
			summary: `Manual Stripe sync: ${synced} updated, ${errors} errors (${purchases.length} total)`,
			metadata: { synced, errors, total: purchases.length },
		});

		return {
			success: true,
			synced,
			errors,
			total: purchases.length,
		};
	});
