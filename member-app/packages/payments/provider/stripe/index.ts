import {
	createPurchase,
	db,
	deletePurchaseBySubscriptionId,
	getPurchaseBySubscriptionId,
	getUserById,
	updatePurchase,
	updatePurchaseSchedule,
} from "@repo/database";
import { logger } from "@repo/logs";
import Stripe from "stripe";
import { setCustomerIdToEntity } from "../../src/lib/customer";
import type {
	CancelSubscription,
	CreateCheckoutLink,
	CreateCustomerPortalLink,
	SetSubscriptionSeats,
	WebhookHandler,
} from "../../types";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
	if (stripeClient) {
		return stripeClient;
	}

	const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;

	if (!stripeSecretKey) {
		throw new Error("Missing env variable STRIPE_SECRET_KEY");
	}

	stripeClient = new Stripe(stripeSecretKey);

	return stripeClient;
}

export const createCheckoutLink: CreateCheckoutLink = async (options) => {
	const stripeClient = getStripeClient();
	const {
		type,
		productId,
		redirectUrl,
		customerId,
		organizationId,
		userId,
		trialPeriodDays,
		seats,
		email,
		referralId,
		affiliateToken,
		allowPromoCodes,
	} = options;

	const metadata = {
		organization_id: organizationId || null,
		user_id: userId || null,
		...(affiliateToken ? { referral: affiliateToken } : {}),
	};

	const response = await stripeClient.checkout.sessions.create({
		mode: type === "subscription" ? "subscription" : "payment",
		success_url: redirectUrl ?? "",
		line_items: [
			{
				quantity: seats ?? 1,
				price: productId,
			},
		],
		...(allowPromoCodes ? { allow_promotion_codes: true } : {}),
		...(customerId ? { customer: customerId } : { customer_email: email }),
		...(referralId ? { client_reference_id: referralId } : {}),
		...(type === "one-time"
			? {
					payment_intent_data: {
						metadata,
					},
					customer_creation: "always",
				}
			: {
					subscription_data: {
						metadata,
						trial_period_days: trialPeriodDays,
					},
				}),
		metadata,
	});

	if (customerId && affiliateToken) {
		await stripeClient.customers.update(customerId, {
			metadata: { referral: affiliateToken },
		});
	}

	return response.url;
};

export const createCustomerPortalLink: CreateCustomerPortalLink = async ({
	customerId,
	redirectUrl,
}) => {
	const stripeClient = getStripeClient();

	const response = await stripeClient.billingPortal.sessions.create({
		customer: customerId,
		return_url: redirectUrl ?? "",
	});

	return response.url;
};

export const setSubscriptionSeats: SetSubscriptionSeats = async ({
	id,
	seats,
}) => {
	const stripeClient = getStripeClient();

	const subscription = await stripeClient.subscriptions.retrieve(id);

	if (!subscription) {
		throw new Error("Subscription not found.");
	}

	await stripeClient.subscriptions.update(id, {
		items: [
			{
				id: subscription.items.data[0].id,
				quantity: seats,
			},
		],
	});
};

export const cancelSubscription: CancelSubscription = async (id) => {
	const stripeClient = getStripeClient();

	await stripeClient.subscriptions.cancel(id);
};

export const webhookHandler: WebhookHandler = async (req) => {
	const stripeClient = getStripeClient();

	if (!req.body) {
		return new Response("Invalid request.", {
			status: 400,
		});
	}

	let event: Stripe.Event | undefined;

	try {
		event = await stripeClient.webhooks.constructEventAsync(
			await req.text(),
			req.headers.get("stripe-signature") as string,
			process.env.STRIPE_WEBHOOK_SECRET as string,
		);
		logger.info("✅ Webhook signature verified", {
			eventType: event?.type,
		});
	} catch (e) {
		logger.error("❌ Webhook signature verification failed", { error: e });

		return new Response("Invalid request.", {
			status: 400,
		});
	}

	try {
		logger.info("Processing webhook event", {
			eventType: event.type,
			eventId: event.id,
		});

		switch (event.type) {
		case "checkout.session.completed": {
			logger.info("🔔 checkout.session.completed event received");
			const { mode, metadata, customer, id } = event.data.object;
			logger.info("Checkout session data", {
				mode,
				sessionId: id,
				customer,
				metadata,
			});

			if (mode === "subscription") {
				// Persist referral attribution from Rewardful.
				// customer.subscription.created fires before this event, so the
				// purchase row should already exist — we just need to stamp it.
				const clientReferenceId =
					event.data.object.client_reference_id ?? undefined;
				const affiliateToken =
					typeof metadata?.affiliate_token === "string" &&
					metadata.affiliate_token.trim().length > 0
						? metadata.affiliate_token.trim()
						: undefined;
				const subscriptionId =
					typeof event.data.object.subscription === "string"
						? event.data.object.subscription
						: event.data.object.subscription?.id;

				if (
					subscriptionId &&
					(clientReferenceId || affiliateToken)
				) {
					logger.info(
						"Rewardful referral detected on subscription checkout",
						{
							clientReferenceId,
							affiliateToken,
							subscriptionId,
						},
					);

					// Update the purchase row created by customer.subscription.created
					const purchase =
						await getPurchaseBySubscriptionId(subscriptionId);
					if (purchase) {
						await updatePurchase({
							id: purchase.id,
							...(clientReferenceId
								? { rewardfulReferralId: clientReferenceId }
								: {}),
							...(affiliateToken
								? { referralCode: affiliateToken }
								: {}),
						});
						logger.info(
							"✅ Stored referral attribution on purchase",
							{
								purchaseId: purchase.id,
								clientReferenceId,
								affiliateToken,
							},
						);

						// Also stamp the user so future re-subscriptions can
						// carry the referral through the internal checkout flow
						if (purchase.userId) {
							const existingUser = await db.user.findUnique({
								where: { id: purchase.userId },
								select: {
									referredBy: true,
									referredBySlug: true,
								},
							});
							const userData: {
								referredBy?: string;
								referredBySlug?: string;
								referralSource?: string;
							} = {};
							if (
								clientReferenceId &&
								!existingUser?.referredBy
							) {
								userData.referredBy = clientReferenceId;
							}
							if (
								affiliateToken &&
								!existingUser?.referredBySlug
							) {
								userData.referredBySlug = affiliateToken;
							}
							if (Object.keys(userData).length > 0) {
								userData.referralSource = "rewardful";
								await db.user.update({
									where: { id: purchase.userId },
									data: userData,
								});
								logger.info(
									"✅ Stored referral attribution on user",
									{
										userId: purchase.userId,
										...userData,
									},
								);
							}
						}
					} else {
						logger.warn(
							"Purchase not found for subscription when saving referral — may need backfill",
							{ subscriptionId },
						);
					}
				}

				logger.info(
					"ℹ️ Subscription checkout.session.completed processed",
				);
				break;
			}

				logger.info("Processing one-time payment checkout");

				const checkoutSession =
					await stripeClient.checkout.sessions.retrieve(id, {
						expand: ["line_items"],
					});

				const productId = checkoutSession.line_items?.data[0].price?.id;

				if (!productId) {
					logger.error("❌ Missing product ID in checkout session");
					return new Response("Missing product ID.", {
						status: 400,
					});
				}

				// Resolve userId — use metadata if present (logged-in customer),
				// otherwise look up or create the user from Stripe customer email.
				let oneTimeUserId: string | null = metadata?.user_id || null;

				if (!oneTimeUserId) {
					const stripeCustomer =
						await stripeClient.customers.retrieve(
							customer as string,
						);
					const email = (stripeCustomer as Stripe.Customer).email;

					if (!email) {
						logger.error(
							"❌ No email on Stripe customer for one-time purchase",
						);
						return new Response("Missing customer email.", {
							status: 400,
						});
					}

					let oneTimeUser = await db.user.findFirst({
						where: {
							OR: [{ stripeEmail: email }, { email }],
						},
					});

					if (!oneTimeUser) {
						logger.info("Creating new user for one-time purchase", {
							email,
						});
						const customerName = (stripeCustomer as Stripe.Customer)
							.name;
						oneTimeUser = await db.user.create({
							data: {
								email,
								stripeEmail: email,
								notificationEmail: email,
								name: customerName || email.split("@")[0],
								emailVerified: true,
								onboardingComplete: false,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
						});
						logger.info("✅ User created for one-time purchase", {
							userId: oneTimeUser.id,
						});
					} else if (!oneTimeUser.stripeEmail) {
						await db.user.update({
							where: { id: oneTimeUser.id },
							data: { stripeEmail: email },
						});
					}

					oneTimeUserId = oneTimeUser.id;
				}

				if (!oneTimeUserId) {
					logger.error(
						"❌ Could not resolve userId for one-time purchase",
					);
					return new Response(
						"Could not resolve user for purchase.",
						{
							status: 400,
						},
					);
				}

				const oneTimeClientRef =
					checkoutSession.client_reference_id ?? undefined;
				const oneTimeAffiliateToken =
					typeof metadata?.affiliate_token === "string" &&
					metadata.affiliate_token.trim().length > 0
						? metadata.affiliate_token.trim()
						: undefined;

				await createPurchase({
					organizationId: metadata?.organization_id || null,
					userId: oneTimeUserId,
					customerId: customer as string,
					type: "ONE_TIME",
					status: "active",
					productId,
					...(oneTimeClientRef
						? { rewardfulReferralId: oneTimeClientRef }
						: {}),
					...(oneTimeAffiliateToken
						? { referralCode: oneTimeAffiliateToken }
						: {}),
				});

				await setCustomerIdToEntity(customer as string, {
					organizationId: metadata?.organization_id,
					userId: oneTimeUserId,
				});

				if (oneTimeClientRef || oneTimeAffiliateToken) {
					const existingOneTimeUser = await db.user.findUnique({
						where: { id: oneTimeUserId },
						select: { referredBy: true, referredBySlug: true },
					});
					const oneTimeUserData: {
						referredBy?: string;
						referredBySlug?: string;
						referralSource?: string;
					} = {};
					if (
						oneTimeClientRef &&
						!existingOneTimeUser?.referredBy
					) {
						oneTimeUserData.referredBy = oneTimeClientRef;
					}
					if (
						oneTimeAffiliateToken &&
						!existingOneTimeUser?.referredBySlug
					) {
						oneTimeUserData.referredBySlug =
							oneTimeAffiliateToken;
					}
					if (Object.keys(oneTimeUserData).length > 0) {
						oneTimeUserData.referralSource = "rewardful";
						await db.user.update({
							where: { id: oneTimeUserId },
							data: oneTimeUserData,
						});
					}
				}

				logger.info("✅ One-time purchase created", {
					userId: oneTimeUserId,
				});

				break;
			}
			case "customer.subscription.created": {
				console.log("🔔 customer.subscription.created event received");
				logger.info("🔔 customer.subscription.created event received");
				const { metadata, customer, items, id } = event.data.object;
				console.log("Event data", {
					customer,
					subscriptionId: id,
					metadata,
					itemsCount: items?.data?.length,
				});
				logger.info("Event data", {
					customer,
					subscriptionId: id,
					metadata,
					itemsCount: items?.data?.length,
				});

				// Get customer details from Stripe
				const stripeCustomer = await stripeClient.customers.retrieve(
					customer as string,
				);
				const email = (stripeCustomer as Stripe.Customer).email;
				console.log("Customer email retrieved:", email);
				logger.info("Customer email retrieved", { email });

				if (!email) {
					console.error("❌ Missing customer email!");
					logger.error("❌ Missing customer email!");
					return new Response("Missing customer email", {
						status: 400,
					});
				}

				// Check if user exists - try Stripe email first, then login email
				let user = await db.user.findFirst({
					where: {
						OR: [{ stripeEmail: email }, { email: email }],
					},
				});
				console.log("User lookup result:", {
					exists: !!user,
					userId: user?.id,
				});
				logger.info("User lookup result", {
					exists: !!user,
					userId: user?.id,
				});

				// Create user if doesn't exist
				if (!user) {
					console.log("Creating new user...");
					logger.info("Creating new user...");
					const customerName = (stripeCustomer as Stripe.Customer)
						.name;

					try {
						user = await db.user.create({
							data: {
								email,
								stripeEmail: email, // Store Stripe email
								notificationEmail: email, // Default to Stripe email
								name: customerName || email.split("@")[0],
								emailVerified: true, // Payment verifies email
								onboardingComplete: false,
								createdAt: new Date(),
								updatedAt: new Date(),
							},
						});
						console.log("✅ User created successfully", {
							userId: user.id,
							email: user.email,
						});
						logger.info("✅ User created successfully", {
							userId: user.id,
						});
					} catch (error) {
						console.error("❌ Failed to create user:", error);
						logger.error("❌ Failed to create user", { error });
						throw error; // Re-throw to trigger webhook retry
					}

					// Note: Session is created by the /api/auth/validate-checkout endpoint
					// when the user returns from Stripe checkout
				} else if (!user.stripeEmail) {
					// Backfill Stripe email for existing users
					await db.user.update({
						where: { id: user.id },
						data: { stripeEmail: email },
					});
					logger.info("Backfilled stripeEmail for existing user", {
						userId: user.id,
						email,
					});
				}

				// Create purchase (existing code continues)
				const productId = items?.data[0].price?.id;
				console.log("Product ID from subscription:", productId);
				logger.info("Product ID from subscription", { productId });

				if (!productId) {
					console.error("❌ Missing product ID!");
					logger.error("❌ Missing product ID!");
					return new Response("Missing product ID.", {
						status: 400,
					});
				}

				try {
					await createPurchase({
						subscriptionId: id,
						organizationId: metadata?.organization_id || null,
						userId: user.id,
						customerId: customer as string,
						type: "SUBSCRIPTION",
						productId,
						status: event.data.object.status,
					});
					console.log("✅ Purchase created successfully", {
						subscriptionId: id,
					});
					logger.info("✅ Purchase created successfully", {
						subscriptionId: id,
						userId: user.id,
					});
				} catch (error) {
					logger.error("❌ Failed to create purchase", { error });
					throw error;
				}

				// Auto-cancel any other active subscriptions for this user
				const existingActive = await db.purchase.findMany({
					where: {
						userId: user.id,
						type: "SUBSCRIPTION",
						status: { in: ["active", "trialing", "grace_period"] },
						NOT: { subscriptionId: id }, // Exclude the new subscription
					},
				});

				if (existingActive.length > 0) {
					logger.warn(
						"Multiple active subscriptions detected, cancelling old ones",
						{
							userId: user.id,
							count: existingActive.length,
						},
					);

					for (const oldPurchase of existingActive) {
						try {
							// Cancel in Stripe
							if (oldPurchase.subscriptionId) {
								await getStripeClient().subscriptions.cancel(
									oldPurchase.subscriptionId,
								);
							}

							// Update in database
							await updatePurchase({
								id: oldPurchase.id,
								status: "cancelled",
							});

							logger.info("Auto-cancelled old subscription", {
								oldSubscriptionId: oldPurchase.subscriptionId,
								newSubscriptionId: id,
							});
						} catch (error) {
							logger.error(
								"Failed to auto-cancel old subscription",
								{
									purchaseId: oldPurchase.id,
									error:
										error instanceof Error
											? error.message
											: String(error),
								},
							);
						}
					}
				}

				try {
					await setCustomerIdToEntity(customer as string, {
						organizationId: metadata?.organization_id,
						userId: user.id,
					});
					logger.info("✅ Customer ID set on entity");
				} catch (error) {
					logger.error("❌ Failed to set customer ID", { error });
					throw error;
				}

				break;
			}
			case "invoice.payment_succeeded": {
				const subscriptionId = (event.data.object as any).subscription;

				if (!subscriptionId) {
					logger.info(
						"Invoice succeeded but no subscription attached",
					);
					break;
				}

				const purchase = await getPurchaseBySubscriptionId(
					subscriptionId as string,
				);

				if (!purchase) {
					logger.warn("Purchase not found for subscription", {
						subscriptionId,
					});
					break;
				}

				// Check if this is a grace period recovery
				if (purchase.status === "grace_period" && purchase.userId) {
					logger.info("Grace period recovery detected", {
						userId: purchase.userId,
						purchaseId: purchase.id,
					});

					// Update purchase to active
					await updatePurchase({
						id: purchase.id,
						status: "active",
						productId:
							(event.data.object as any).lines?.data[0]?.price
								?.id || purchase.productId,
					});

					// Restore Discord role
					const user = await getUserById(purchase.userId);
					if (user?.discordId) {
						const { grantActiveRole } = await import(
							"@repo/discord"
						);
						const result = await grantActiveRole(user.discordId);

						if (result.success) {
							// Create audit log
							await db.discordAudit.create({
								data: {
									userId: user.id,
									discordId: user.discordId,
									discordUsername: user.discordUsername,
									action: "role_changed",
									reason: "grace_period_recovered",
									metadata: { purchaseId: purchase.id },
								},
							});

							logger.info(
								"Discord role restored after grace period recovery",
								{
									userId: user.id,
									discordId: user.discordId,
								},
							);
						}
					}

					// TODO: Send "Payment Successful" email
					// TODO: Create user notification
				}

				break;
			}
			case "invoice.payment_failed": {
				const subscriptionId = (event.data.object as any).subscription;

				if (!subscriptionId) {
					logger.info("Invoice failed but no subscription attached");
					break;
				}

				const purchase = await getPurchaseBySubscriptionId(
					subscriptionId as string,
				);

				if (!purchase) {
					logger.warn("Purchase not found for subscription", {
						subscriptionId,
					});
					break;
				}

				// Update purchase to grace_period
				if (purchase.status === "active" && purchase.userId) {
					logger.info("Payment failed, moving to grace period", {
						userId: purchase.userId,
						purchaseId: purchase.id,
					});

					// Calculate grace period end (7 days from now)
					const gracePeriodEnd = new Date();
					gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

					await updatePurchase({
						id: purchase.id,
						status: "grace_period",
					});

					// Update currentPeriodEnd to grace period end
					await db.purchase.update({
						where: { id: purchase.id },
						data: { currentPeriodEnd: gracePeriodEnd },
					});

					// Change Discord role to grace period (Support Only)
					const user = await getUserById(purchase.userId);
					if (user?.discordId) {
						const { changeToGracePeriodRole, resolvePlanRoleId } =
							await import("@repo/discord");
						const planRoleId = user.discordRoleKey
							? resolvePlanRoleId(user.discordRoleKey)
							: null;
						const result = await changeToGracePeriodRole(
							user.discordId,
							planRoleId ?? undefined,
						);

						if (result.success) {
							// Create audit log
							await db.discordAudit.create({
								data: {
									userId: user.id,
									discordId: user.discordId,
									discordUsername: user.discordUsername,
									action: "role_changed",
									reason: "payment_failed",
									metadata: {
										purchaseId: purchase.id,
										gracePeriodEnd:
											gracePeriodEnd.toISOString(),
									},
								},
							});

							logger.info(
								"Discord role changed to grace period",
								{
									userId: user.id,
									discordId: user.discordId,
								},
							);
						}
					}

					// Create user notification with banner
					try {
						await db.notification.create({
							data: {
								userId: purchase.userId,
								type: "warning",
								title: "Payment Failed",
								message:
									"Your payment could not be processed. Please update your payment method to continue your subscription.",
							},
						});
					} catch (error) {
						logger.error(
							"Failed to create payment failed notification",
							{
								userId: purchase.userId,
								error:
									error instanceof Error
										? error.message
										: String(error),
							},
						);
					}
				}

				break;
			}
			case "customer.subscription.updated": {
				const subscriptionId = event.data.object.id;

				const existingPurchase =
					await getPurchaseBySubscriptionId(subscriptionId);

				if (existingPurchase) {
					await updatePurchase({
						id: existingPurchase.id,
						status: event.data.object.status,
						productId: event.data.object.items?.data[0].price?.id,
					});
				}

				break;
			}
			case "customer.subscription.deleted": {
				const subscriptionId = event.data.object.id;

				const deletedPurchase =
					await getPurchaseBySubscriptionId(subscriptionId);

				if (deletedPurchase?.userId) {
					const user = await getUserById(deletedPurchase.userId);

					if (user?.discordId) {
						const discordId = user.discordId;
						const { removeUserFromServer } = await import(
							"@repo/discord"
						);

						// Only attempt kick if still marked connected — extended handler
						// may have already kicked them, but DB cleanup always runs to
						// ensure account rows and audit are consistent.
						let kickResult: { success: boolean; error?: string } = {
							success: false,
							error: "skipped_already_disconnected",
						};
						if (user.discordConnected) {
							kickResult = await removeUserFromServer(
								discordId,
								"Subscription canceled",
							);
							if (kickResult.success) {
								logger.info(
									"User kicked from Discord on subscription deletion",
									{ userId: user.id, discordId },
								);
							} else {
								logger.warn(
									"Discord kick failed on subscription deletion — DB cleaned up anyway",
									{
										userId: user.id,
										discordId,
										error: kickResult.error,
									},
								);
							}
						} else {
							logger.info(
								"Discord already disconnected before core handler — skipping kick, running DB cleanup",
								{ userId: user.id, discordId },
							);
						}

						await db.$transaction(async (tx) => {
							await tx.user.update({
								where: { id: user.id },
								data: {
									discordConnected: false,
									discordConnectedAt: null,
								},
							});

							await tx.account.deleteMany({
								where: {
									userId: user.id,
									providerId: "discord",
								},
							});

							await tx.discordAudit.create({
								data: {
									userId: user.id,
									discordId,
									discordUsername: user.discordUsername,
									action: "kicked",
									reason: "subscription_deleted",
									metadata: {
										subscriptionId,
										kickSuccess: kickResult.success,
										kickError: kickResult.error ?? null,
									},
								},
							});
						});
					}
				}

				await deletePurchaseBySubscriptionId(subscriptionId);

				break;
			}

		case "subscription_schedule.updated": {
			const schedule = event.data.object as Stripe.SubscriptionSchedule;
			const subscriptionId =
				typeof schedule.subscription === "string"
					? schedule.subscription
					: (schedule.subscription as Stripe.Subscription | null)?.id;

			if (!subscriptionId) {
				break;
			}

			const schedulePurchase =
				await getPurchaseBySubscriptionId(subscriptionId);
			if (!schedulePurchase) {
				break;
			}

			// Find a future phase — the next phase starts when the current one ends.
			const currentEndDate = schedule.current_phase?.end_date;
			const phases = schedule.phases ?? [];
			const nextPhase = currentEndDate
				? phases.find((p) => p.start_date === currentEndDate)
				: null;

			if (nextPhase && currentEndDate) {
				const nextPriceRaw = nextPhase.items?.[0]?.price;
				const nextPriceId =
					typeof nextPriceRaw === "string"
						? nextPriceRaw
						: (nextPriceRaw as Stripe.Price | null)?.id ?? null;

				// Resolve human-readable plan name from marketing pricing plans
				let pendingPlanName: string | null = null;
				if (nextPriceId) {
					const marketingPlan = await db.marketingPricingPlan.findFirst({
						where: { stripePriceId: nextPriceId },
						select: { name: true },
					});
					pendingPlanName = marketingPlan?.name ?? nextPriceId;
				}

			await updatePurchaseSchedule(schedulePurchase.id, {
				scheduleId: schedule.id,
				pendingPriceId: nextPriceId,
				pendingPlanName,
				pendingPlanChangeAt: new Date(currentEndDate * 1000),
			});

				logger.info("✅ Stored pending plan change from schedule", {
					purchaseId: schedulePurchase.id,
					scheduleId: schedule.id,
					nextPriceId,
					pendingPlanName,
					changeAt: new Date(currentEndDate * 1000).toISOString(),
				});
			} else {
			// No next phase — clear any stale pending data
			await updatePurchaseSchedule(schedulePurchase.id, {
				scheduleId: schedule.id,
				pendingPriceId: null,
				pendingPlanName: null,
				pendingPlanChangeAt: null,
			});
				logger.info("ℹ️ Schedule has no next phase — cleared pending plan change", {
					purchaseId: schedulePurchase.id,
					scheduleId: schedule.id,
				});
			}

			break;
		}

		case "subscription_schedule.released":
		case "subscription_schedule.canceled":
		case "subscription_schedule.completed": {
			const schedule = event.data.object as Stripe.SubscriptionSchedule;
			const subscriptionId =
				typeof schedule.subscription === "string"
					? schedule.subscription
					: (schedule.subscription as Stripe.Subscription | null)?.id;

			if (!subscriptionId) {
				break;
			}

			const releasedPurchase =
				await getPurchaseBySubscriptionId(subscriptionId);
			if (!releasedPurchase) {
				break;
			}

		await updatePurchaseSchedule(releasedPurchase.id, {
			scheduleId: null,
			pendingPriceId: null,
			pendingPlanName: null,
			pendingPlanChangeAt: null,
		});

			logger.info("✅ Cleared pending plan change — schedule ended", {
				purchaseId: releasedPurchase.id,
				eventType: event.type,
			});

			break;
		}

		default:
			return new Response("Unhandled event type.", {
				status: 200,
			});
	}

		return new Response(null, { status: 204 });
	} catch (error) {
		return new Response(
			`Webhook error: ${error instanceof Error ? error.message : ""}`,
			{
				status: 400,
			},
		);
	}
};
