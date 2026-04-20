import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getStripeClient } from "@repo/payments";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

function isStripeSubscriptionNotFoundError(error: unknown): boolean {
	if (error && typeof error === "object" && "code" in error) {
		const code = (error as { code?: string }).code;
		if (code === "resource_missing") {
			return true;
		}
	}
	const message = error instanceof Error ? error.message : String(error);
	return message.includes("No such subscription");
}

export async function GET(request: Request) {
	try {
		// Verify cron secret
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			logger.warn("Unauthorized cron attempt", {
				hasAuth: !!authHeader,
				hasSecret: !!cronSecret,
			});
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		logger.info("Starting Stripe subscription sync");

		const stripe = getStripeClient();

		// Get all active purchases with subscription IDs
		const purchases = await db.purchase.findMany({
			where: {
				status: { in: ["active", "trialing", "past_due"] },
				subscriptionId: { not: null },
				type: "SUBSCRIPTION",
			},
		});

		logger.info(`Found ${purchases.length} subscriptions to sync`);

		let synced = 0;
		let errors = 0;

		// Process in batches of 10 to avoid rate limits
		for (let i = 0; i < purchases.length; i += 10) {
			const batch = purchases.slice(i, i + 10);

			await Promise.all(
				batch.map(async (purchase) => {
					try {
						if (!purchase.subscriptionId) {
							return;
						}

						// Fetch subscription from Stripe with expanded discount data
						const subscriptionResponse =
							await stripe.subscriptions.retrieve(
								purchase.subscriptionId,
								{
									expand: [
										"discount.coupon",
										"discounts.coupon",
									],
								},
							);
						const subscription = subscriptionResponse as any;

						// Check for period_end in multiple locations
						const subscriptionItem = subscription.items?.data?.[0];
						const periodEnd =
							subscription.current_period_end ||
							subscription.currentPeriodEnd ||
							subscriptionItem?.current_period_end ||
							subscriptionItem?.currentPeriodEnd;

						// Also fetch the latest invoice to check actual amount charged
						// This handles "once" duration coupons that only apply to first invoice
						// For Flexible billing: period info is on invoice line items
						const invoices = await stripe.invoices.list({
							subscription: purchase.subscriptionId,
							limit: 1,
							expand: ["data.lines", "data.discounts.coupon"],
						});
						const latestInvoice = invoices.data[0] as any;

						// Try to get period_end from invoice if not on subscription
						const invoicePeriodEnd =
							latestInvoice?.lines?.data?.[0]?.period?.end ||
							latestInvoice?.period_end;
						const finalPeriodEnd = periodEnd || invoicePeriodEnd;

						const item = subscriptionItem;
						if (!item) {
							return;
						}
						const price = item.price;

						// Calculate actual amount after discounts
						let amount = price.unit_amount || 0;
						let discountPercent = 0;
						let couponId: string | null = null;
						let couponName: string | null = null;

						// Check for discount - multiple sources:
						// 1. subscription.discount (recurring discounts)
						// 2. subscription.discounts array (newer API)
						// 3. Latest invoice total (for "once" duration coupons)
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
									amount =
										amount * (1 - discountPercent / 100);
								} else if (coupon.amount_off) {
									amount = Math.max(
										0,
										amount - coupon.amount_off,
									);
								}
							} else if (typeof coupon === "string") {
								couponId = coupon;
							}
						} else if (latestInvoice) {
							// No subscription-level discount - check invoice
							const invoiceTotal =
								latestInvoice.total ??
								latestInvoice.amount_paid ??
								0;
							const invoiceSubtotal =
								latestInvoice.subtotal ?? amount;
							const invoiceDiscount = latestInvoice.discount;
							const invoiceDiscountAmounts =
								latestInvoice.total_discount_amounts;

							if (
								invoiceDiscount &&
								typeof invoiceDiscount !== "string" &&
								invoiceDiscount.coupon
							) {
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
								amount = invoiceTotal;
							} else if (
								invoiceDiscountAmounts &&
								invoiceDiscountAmounts.length > 0
							) {
								const discountAmount =
									invoiceDiscountAmounts[0]?.amount || 0;
								if (discountAmount > 0) {
									amount = invoiceTotal;
									const discountId =
										invoiceDiscountAmounts[0]?.discount;
									if (
										discountId &&
										typeof discountId === "string"
									) {
										couponId = discountId;
									}
								}
							} else if (
								invoiceSubtotal > 0 &&
								invoiceTotal === 0
							) {
								// 100% discount detected
								amount = 0;
								discountPercent = 100;
							}
						}

						// If we have a coupon/discount ID but no name, try to fetch it from Stripe
						if (couponId && !couponName) {
							try {
								// Check if it's a discount ID (di_...) or coupon ID
								if (couponId.startsWith("di_")) {
									// It's a discount ID - try to get coupon from expanded invoice discounts
									const invoiceDiscounts =
										latestInvoice?.discounts;
									if (Array.isArray(invoiceDiscounts)) {
										for (const disc of invoiceDiscounts) {
											if (
												disc &&
												typeof disc !== "string" &&
												disc.coupon
											) {
												const coupon = disc.coupon;
												if (
													typeof coupon !== "string"
												) {
													couponName =
														coupon.name || null;
													couponId = coupon.id;
													break;
												}
											}
										}
									}

									// If still no name, try invoice line item discounts
									if (!couponName) {
										const lineDiscounts =
											latestInvoice?.lines?.data?.[0]
												?.discounts;
										if (Array.isArray(lineDiscounts)) {
											for (const disc of lineDiscounts) {
												if (
													disc &&
													typeof disc !== "string" &&
													disc.coupon
												) {
													const coupon = disc.coupon;
													if (
														typeof coupon !==
														"string"
													) {
														couponName =
															coupon.name || null;
														couponId = coupon.id;
														break;
													}
												}
											}
										}
									}
								} else {
									// It's a coupon ID - fetch directly
									const couponData =
										await stripe.coupons.retrieve(couponId);
									couponName = couponData.name || null;
								}
							} catch {
								// Coupon/discount may not exist or be deleted
							}
						}

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
								cachedDiscountPercent:
									discountPercent > 0
										? discountPercent
										: null,
								stripeSyncedAt: new Date(),
								status: subscription.status,
								currentPeriodEnd: finalPeriodEnd
									? new Date(finalPeriodEnd * 1000)
									: null,
							},
						});

						synced++;
					} catch (error) {
						if (isStripeSubscriptionNotFoundError(error)) {
							logger.warn(
								"Subscription missing in Stripe — marking purchase canceled",
								{
									purchaseId: purchase.id,
									subscriptionId: purchase.subscriptionId,
								},
							);
							await db.purchase.update({
								where: { id: purchase.id },
								data: {
									status: "canceled",
									cancelledAt: new Date(),
									stripeSyncedAt: new Date(),
								},
							});
							synced++;
						} else {
							logger.error("Failed to sync subscription", {
								purchaseId: purchase.id,
								subscriptionId: purchase.subscriptionId,
								error:
									error instanceof Error
										? error.message
										: String(error),
							});
							errors++;
						}
					}
				}),
			);

			// Small delay between batches to respect rate limits
			if (i + 10 < purchases.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		logger.info("Stripe subscription sync complete", {
			total: purchases.length,
			synced,
			errors,
		});

		return NextResponse.json({
			success: true,
			synced,
			errors,
			total: purchases.length,
		});
	} catch (error) {
		logger.error("Stripe sync cron job failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
