import { GRACE_PERIOD_DAYS } from "@repo/config/constants";
import { db, notifyAllAdmins } from "@repo/database";
import {
	changeToGracePeriodRole,
	removeUserFromServer,
	resolvePlanRoleId,
} from "@repo/discord";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import type Stripe from "stripe";
import { checkAndGrantDiscordAccess } from "./discord-helper";
import { getMarketingPlanNameByStripePriceId } from "./plan-display-name";

function getSubscriptionCurrentPeriodEndUnix(
	subscription: Stripe.Subscription,
): number | null {
	const firstItem = subscription.items?.data?.[0];
	if (firstItem?.current_period_end != null) {
		return firstItem.current_period_end;
	}
	const legacy = subscription as unknown as {
		current_period_end?: number;
		currentPeriodEnd?: number;
	};
	if (typeof legacy.current_period_end === "number") {
		return legacy.current_period_end;
	}
	if (typeof legacy.currentPeriodEnd === "number") {
		return legacy.currentPeriodEnd;
	}
	return null;
}

/**
 * Handle extended webhook logic (grace period, Discord, notifications)
 * Called AFTER Supastarter's core webhook handler processes the event
 */
export async function handleExtendedWebhookLogic(
	event: Stripe.Event,
): Promise<void> {
	logger.info("🔔 Webhook received", {
		type: event.type,
		eventId: event.id,
	});

	// Check idempotency
	const existing = await db.webhookEvent.findUnique({
		where: { id: event.id },
	});

	if (existing?.processed) {
		logger.warn("⚠️  Webhook already processed (idempotency)", {
			eventId: event.id,
			type: event.type,
		});
		return;
	}

	// Mark as processed (or create if doesn't exist)
	await db.webhookEvent.upsert({
		where: { id: event.id },
		update: { processed: true },
		create: {
			id: event.id,
			type: event.type,
			processed: true,
		},
	});

	logger.info("✅ Webhook marked as processed", { eventId: event.id });

	// Handle specific event types
	switch (event.type) {
		case "checkout.session.completed":
			await handleOneTimeCheckoutCompleted(event);
			break;
		case "invoice.payment_failed":
			await handlePaymentFailed(event);
			break;
		case "invoice.paid":
			await handlePaymentSucceeded(event);
			break;
		case "customer.subscription.deleted":
			await handleSubscriptionDeleted(event);
			break;
		case "customer.subscription.updated":
			await handleSubscriptionUpdated(event);
			break;
		default:
			logger.info("ℹ️  Event type not handled by extension logic", {
				type: event.type,
			});
			break;
	}
}

async function handleOneTimeCheckoutCompleted(event: Stripe.Event) {
	const session = event.data.object as Stripe.Checkout.Session;

	// Only handle one-time payments — subscriptions are handled by customer.subscription.created
	if (session.mode !== "payment") {
		logger.info(
			"ℹ️  checkout.session.completed — subscription mode, skipping one-time handler",
		);
		return;
	}

	logger.info("💳 Processing checkout.session.completed (one-time payment)", {
		sessionId: session.id,
	});

	const userId = session.metadata?.user_id;

	if (!userId) {
		logger.warn(
			"   ⚠️  No user_id in metadata — Discord role will be granted when user connects Discord",
		);
		return;
	}

	// Notify admins of new one-time purchase
	await notifyAllAdmins({
		type: "subscription_new",
		title: "New One-Time Purchase",
		message: `A user completed a one-time purchase (session: ${session.id})`,
	}).catch((error) => {
		logger.error("   ❌ Failed to notify admins", {
			error: error instanceof Error ? error.message : String(error),
		});
	});

	// Grant Discord access if user already has Discord connected
	const discordResult = await checkAndGrantDiscordAccess(userId);

	if (discordResult.success) {
		logger.info("   ✅ Discord access granted for one-time purchase", {
			userId,
		});
	} else {
		logger.info(
			"   ℹ️  Discord not granted yet (user may connect Discord later)",
			{
				userId,
				reason: discordResult.error,
			},
		);
	}
}

async function handlePaymentFailed(event: Stripe.Event) {
	logger.info("💳 Processing invoice.payment_failed", { eventId: event.id });

	const invoice = event.data.object as Stripe.Invoice;
	const subscriptionId =
		typeof (invoice as any).subscription === "string"
			? (invoice as any).subscription
			: ((invoice as any).subscription?.id ?? null);

	logger.info("   Subscription ID from invoice", {
		subscriptionId: subscriptionId || "null",
		invoiceId: invoice.id,
	});

	if (!subscriptionId) {
		logger.warn("   ⚠️  No subscription ID - skipping (one-time invoice)");
		return;
	}

	// Get purchase
	const purchase = await db.purchase.findUnique({
		where: { subscriptionId },
		include: { user: true },
	});

	if (!purchase) {
		logger.warn("   ⚠️  Purchase not found for subscription", {
			subscriptionId,
		});
		return;
	}

	if (!purchase.user) {
		logger.warn("   ⚠️  Purchase has no user", { purchaseId: purchase.id });
		return;
	}

	logger.info("   ✅ Purchase found", {
		purchaseId: purchase.id,
		userId: purchase.userId,
		currentStatus: purchase.status,
		userEmail: purchase.user.email,
	});

	// Set grace period (7 days)
	const gracePeriodEnd = new Date(
		Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
	);

	logger.info("   📝 Updating purchase status", {
		from: purchase.status,
		to: "grace_period",
		gracePeriodEnd: gracePeriodEnd.toISOString(),
	});

	await db.purchase.update({
		where: { id: purchase.id },
		data: {
			status: "grace_period",
			currentPeriodEnd: gracePeriodEnd,
		},
	});

	logger.info("   ✅ Purchase status updated to grace_period");

	// Send email
	if (purchase.user.email) {
		const updatePaymentUrl = process.env.NEXT_PUBLIC_APP_URL
			? `${process.env.NEXT_PUBLIC_APP_URL}/account/billing`
			: "#";

		logger.info("   📧 Sending grace period email", {
			to: purchase.user.email,
		});

		await sendEmail({
			to: purchase.user.email,
			templateId: "gracePeriod",
			context: {
				name: purchase.user.name,
				expiresAt: gracePeriodEnd,
				updatePaymentUrl,
			},
		})
			.then(() => {
				logger.info("   ✅ Grace period email sent");
			})
			.catch((error) => {
				logger.error("   ❌ Failed to send grace period email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
	} else {
		logger.warn("   ⚠️  No email address - skipping email");
	}

	// Change Discord role (active → grace period)
	if (purchase.user.discordId) {
		logger.info("   🎮 Changing Discord role to grace period", {
			discordId: purchase.user.discordId,
		});

		const planRoleId = purchase.user.discordRoleKey
			? resolvePlanRoleId(purchase.user.discordRoleKey)
			: null;
		const result = await changeToGracePeriodRole(
			purchase.user.discordId,
			planRoleId ?? undefined,
		);

		if (result.success) {
			logger.info("   ✅ Discord role changed to grace period");
		} else {
			logger.error("   ❌ Discord role change failed", {
				userId: purchase.userId,
				discordId: purchase.user.discordId,
				error: result.error,
			});
		}
	} else {
		logger.warn("   ⚠️  No Discord ID - skipping Discord role change");
	}

	// Create notification
	logger.info("   🔔 Creating notification");

	if (purchase.userId) {
		await db.notification
			.create({
				data: {
					userId: purchase.userId,
					type: "warning",
					title: "Payment Failed",
					message: `Your payment failed. Please update your payment method within ${GRACE_PERIOD_DAYS} days.`,
				},
			})
			.then(() => {
				logger.info("   ✅ Notification created");
			})
			.catch((error) => {
				logger.error("   ❌ Failed to create notification", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
	}

	// Notify admins of payment failure
	await notifyAllAdmins({
		type: "payment_failed",
		title: "Payment Failed",
		message: `Payment failed for ${purchase.user?.name || purchase.user?.email || "unknown user"}`,
	}).catch((error) => {
		logger.error("   ❌ Failed to notify admins", {
			error: error instanceof Error ? error.message : String(error),
		});
	});

	logger.info("✅ Payment failed handler complete", { eventId: event.id });
}

async function handlePaymentSucceeded(event: Stripe.Event) {
	logger.info("💰 Processing invoice.paid", { eventId: event.id });

	const invoice = event.data.object as Stripe.Invoice;
	const subscriptionId =
		typeof (invoice as any).subscription === "string"
			? (invoice as any).subscription
			: ((invoice as any).subscription?.id ?? null);

	logger.info("   Subscription ID from invoice", {
		subscriptionId: subscriptionId || "null",
		invoiceId: invoice.id,
	});

	if (!subscriptionId) {
		logger.warn("   ⚠️  No subscription ID - skipping (one-time payment)");
		return;
	}

	// Get purchase
	const purchase = await db.purchase.findUnique({
		where: { subscriptionId },
		include: { user: true },
	});

	if (!purchase) {
		logger.warn("   ⚠️  Purchase not found for subscription", {
			subscriptionId,
		});
		return;
	}

	if (!purchase.user) {
		logger.warn("   ⚠️  Purchase has no user", { purchaseId: purchase.id });
		return;
	}

	// Check if recovering from grace period
	const wasGracePeriod = purchase.status === "grace_period";

	logger.info("   ✅ Purchase found", {
		purchaseId: purchase.id,
		userId: purchase.userId,
		currentStatus: purchase.status,
		wasGracePeriod,
	});

	logger.info("   📝 Updating purchase status", {
		from: purchase.status,
		to: "active",
	});

	// Update to active
	await db.purchase.update({
		where: { id: purchase.id },
		data: {
			status: "active",
			currentPeriodEnd: new Date(invoice.period_end * 1000),
		},
	});

	logger.info("   ✅ Purchase status updated to active");

	// If recovering from grace period
	if (wasGracePeriod) {
		logger.info(
			"   🎉 Recovering from grace period - sending notifications",
		);

		// Send reactivation email
		if (purchase.user.email) {
			logger.info("   📧 Sending reactivation email", {
				to: purchase.user.email,
			});

			const planName = await getMarketingPlanNameByStripePriceId(
				purchase.productId,
			);

			await sendEmail({
				to: purchase.user.email,
				templateId: "subscriptionReactivated",
				context: {
					name: purchase.user.name,
					planName,
					nextBillingDate: new Date(invoice.period_end * 1000),
				},
			})
				.then(() => {
					logger.info("   ✅ Reactivation email sent");
				})
				.catch((error) => {
					logger.error("   ❌ Failed to send reactivation email", {
						userId: purchase.userId,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				});
		}

		// Change Discord role (grace period → active) — plan-aware via shared helper
		if (purchase.user.discordId && purchase.userId) {
			logger.info("   🎮 Syncing Discord roles after grace recovery", {
				discordId: purchase.user.discordId,
			});

			const result = await checkAndGrantDiscordAccess(purchase.userId);

			if (result.success) {
				logger.info("   ✅ Discord roles synced after recovery");
			} else {
				logger.error("   ❌ Discord role sync failed", {
					userId: purchase.userId,
					discordId: purchase.user.discordId,
					error: result.error,
				});
			}
		}

		// Create notification
		logger.info("   🔔 Creating success notification");

		if (purchase.userId) {
			await db.notification
				.create({
					data: {
						userId: purchase.userId,
						type: "success",
						title: "Payment Successful",
						message:
							"Your payment was successful. Access restored!",
					},
				})
				.then(() => {
					logger.info("   ✅ Notification created");
				})
				.catch((error) => {
					logger.error("   ❌ Failed to create notification", {
						userId: purchase.userId,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				});
		}
	} else {
		logger.info("   ℹ️  Regular payment (not recovering from grace period)");

		// Notify admins of new subscription (only for new subscriptions, not recoveries)
		if (purchase.type === "SUBSCRIPTION") {
			await notifyAllAdmins({
				type: "subscription_new",
				title: "New Subscription",
				message: `${purchase.user?.name || purchase.user?.email || "A user"} subscribed`,
			}).catch((error) => {
				logger.error("   ❌ Failed to notify admins", {
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
		}
	}

	logger.info("✅ Payment succeeded handler complete", { eventId: event.id });
}

async function handleSubscriptionUpdated(event: Stripe.Event) {
	const subscription = event.data.object as Stripe.Subscription;
	const previousAttributes = event.data.previous_attributes as
		| Record<string, unknown>
		| undefined;

	const prevCancelAtPeriodEnd = previousAttributes?.cancel_at_period_end;
	const prevCancelAt = previousAttributes?.cancel_at;

	// Standard billing: cancel_at_period_end flips false → true
	const isCancelAtPeriodEndTrigger =
		subscription.cancel_at_period_end === true &&
		prevCancelAtPeriodEnd === false;

	// Flexible billing: cancel_at is newly set (explicitly listed in previous_attributes
	// as null, meaning it changed FROM null TO a timestamp in this specific event)
	const isCancelAtTrigger =
		subscription.cancel_at != null &&
		previousAttributes != null &&
		"cancel_at" in previousAttributes &&
		(prevCancelAt === null || prevCancelAt === undefined) &&
		subscription.cancel_at_period_end === false;

	if (isCancelAtPeriodEndTrigger || isCancelAtTrigger) {
		logger.info(
			`ℹ️  Cancel signal detected (${isCancelAtTrigger ? "cancel_at" : "cancel_at_period_end"})`,
			{ subscriptionId: subscription.id },
		);
		await handleSubscriptionCancelAtPeriodEndSet(event, subscription);
	}

	// Standard billing: cancel_at_period_end flips true → false (user clicked "don't cancel")
	const isUndoCancelPeriodEndTrigger =
		subscription.cancel_at_period_end === false &&
		prevCancelAtPeriodEnd === true;

	// Flexible billing: cancel_at goes from a timestamp back to null (user clicked "don't cancel")
	const isUndoCancelAtTrigger =
		subscription.cancel_at === null &&
		previousAttributes != null &&
		"cancel_at" in previousAttributes &&
		typeof prevCancelAt === "number";

	if (isUndoCancelPeriodEndTrigger || isUndoCancelAtTrigger) {
		const purchaseForReactivate = await db.purchase.findUnique({
			where: { subscriptionId: subscription.id },
		});
		if (purchaseForReactivate) {
			const periodEndUnix =
				getSubscriptionCurrentPeriodEndUnix(subscription);
			const nextPeriodEnd =
				periodEndUnix != null
					? new Date(periodEndUnix * 1000)
					: (purchaseForReactivate.currentPeriodEnd ?? new Date());

			await db.purchase.update({
				where: { id: purchaseForReactivate.id },
				data: {
					cancelAtPeriodEnd: false,
					currentPeriodEnd: nextPeriodEnd,
				},
			});
			logger.info(
				`   ✅ Purchase cancelAtPeriodEnd cleared (${isUndoCancelAtTrigger ? "cancel_at removed" : "cancel_at_period_end cleared"})`,
				{ purchaseId: purchaseForReactivate.id },
			);
		}
	}

	if (!previousAttributes?.items) {
		logger.info(
			"ℹ️  customer.subscription.updated — no subscription items change, skipping Discord",
			{ eventId: event.id },
		);
		return;
	}

	const purchase = await db.purchase.findUnique({
		where: { subscriptionId: subscription.id },
		include: { user: true },
	});

	if (!purchase?.user?.discordId || !purchase.userId) {
		logger.info(
			"ℹ️  customer.subscription.updated — user has no linked Discord, skipping",
			{ subscriptionId: subscription.id },
		);
		return;
	}

	const syncUserId = purchase.userId;

	logger.info("🔄 Subscription items changed — syncing Discord roles", {
		eventId: event.id,
		userId: syncUserId,
	});

	const discordResult = await checkAndGrantDiscordAccess(syncUserId);

	if (discordResult.success) {
		logger.info("   ✅ Discord roles synced after plan/price change");
	} else {
		logger.error(
			"   ❌ Discord role sync failed after subscription update",
			{
				userId: purchase.userId,
				error: discordResult.error,
			},
		);
	}
}

async function handleSubscriptionCancelAtPeriodEndSet(
	event: Stripe.Event,
	subscription: Stripe.Subscription,
) {
	logger.info("📅 Subscription set to cancel at period end", {
		eventId: event.id,
		subscriptionId: subscription.id,
	});

	const purchase = await db.purchase.findUnique({
		where: { subscriptionId: subscription.id },
		include: { user: true },
	});

	if (!purchase) {
		logger.warn("   ⚠️  Purchase not found for subscription", {
			subscriptionId: subscription.id,
		});
		return;
	}

	if (!purchase.user) {
		logger.warn("   ⚠️  Purchase has no user", { purchaseId: purchase.id });
		return;
	}

	// Flexible billing uses cancel_at; standard billing uses current_period_end on the item
	const cancelAtUnix =
		typeof subscription.cancel_at === "number"
			? subscription.cancel_at
			: null;
	const periodEndUnix =
		cancelAtUnix ?? getSubscriptionCurrentPeriodEndUnix(subscription);
	const accessEndDate =
		periodEndUnix != null
			? new Date(periodEndUnix * 1000)
			: (purchase.currentPeriodEnd ?? new Date());
	const accessEndLabel = accessEndDate.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	await db.purchase.update({
		where: { id: purchase.id },
		data: {
			cancelAtPeriodEnd: true,
			currentPeriodEnd: accessEndDate,
		},
	});

	logger.info("   ✅ Purchase updated (cancelAtPeriodEnd=true)", {
		purchaseId: purchase.id,
		currentPeriodEnd: accessEndDate.toISOString(),
	});

	const billingBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
	const reactivateUrl = billingBase
		? `${billingBase}/app/settings/billing`
		: "#";

	if (purchase.user.email) {
		logger.info("   📧 Sending cancellation confirmation email", {
			to: purchase.user.email,
		});

		await sendEmail({
			to: purchase.user.email,
			templateId: "subscriptionCanceled",
			context: {
				name: purchase.user.name,
				cancelledAt: new Date(),
				reactivateUrl,
			},
		})
			.then(() => {
				logger.info("   ✅ Cancellation confirmation email sent");
			})
			.catch((error) => {
				logger.error("   ❌ Failed to send cancellation email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
	} else {
		logger.warn("   ⚠️  No email address - skipping cancellation email");
	}

	if (purchase.userId) {
		await db.notification
			.create({
				data: {
					userId: purchase.userId,
					type: "info",
					title: "Subscription Cancelled",
					message: `Your subscription has been cancelled. You'll continue to have full access until ${accessEndLabel}. You can reactivate anytime before then.`,
				},
			})
			.then(() => {
				logger.info("   ✅ User notification created");
			})
			.catch((error) => {
				logger.error("   ❌ Failed to create notification", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
	}

	const userLabel = purchase.user.name || purchase.user.email || "A user";

	await notifyAllAdmins({
		type: "subscription_cancelled",
		title: "Subscription Cancelled",
		message: `${userLabel} scheduled cancellation — access expires ${accessEndLabel}.`,
	}).catch((error) => {
		logger.error("   ❌ Failed to notify admins", {
			error: error instanceof Error ? error.message : String(error),
		});
	});
}

async function handleSubscriptionDeleted(event: Stripe.Event) {
	logger.info("🚫 Processing customer.subscription.deleted", {
		eventId: event.id,
	});

	const subscription = event.data.object as Stripe.Subscription;

	logger.info("   Subscription ID", { subscriptionId: subscription.id });

	// Get purchase
	const purchase = await db.purchase.findUnique({
		where: { subscriptionId: subscription.id },
		include: { user: true },
	});

	if (!purchase) {
		logger.warn("   ⚠️  Purchase not found for subscription", {
			subscriptionId: subscription.id,
		});
		return;
	}

	if (!purchase.user) {
		logger.warn("   ⚠️  Purchase has no user", { purchaseId: purchase.id });
		return;
	}

	logger.info("   ✅ Purchase found", {
		purchaseId: purchase.id,
		userId: purchase.userId,
		currentStatus: purchase.status,
	});

	logger.info("   📝 Updating purchase status to canceled");

	// Update status to canceled
	await db.purchase.update({
		where: { id: purchase.id },
		data: {
			status: "canceled",
			cancelledAt: new Date(),
		},
	});

	logger.info("   ✅ Purchase status updated to canceled");

	const cancellationReason = subscription.cancellation_details?.reason;

	const purchaseUser = purchase.user;

	if (purchaseUser.discordId) {
		const discordId = purchaseUser.discordId;

		if (cancellationReason === "cancellation_requested") {
			logger.info("   🎮 Voluntary cancel — removing user from Discord", {
				discordId,
			});

			const kickResult = await removeUserFromServer(discordId);

			if (kickResult.success) {
				logger.info("   ✅ User removed from Discord server");
			} else {
				logger.error("   ❌ Failed to remove user from Discord", {
					userId: purchase.userId,
					discordId,
					error: kickResult.error,
				});
			}

			// Always clean up Discord state regardless of kick success —
			// the subscription is gone so access should be revoked in DB either way.
			await db.$transaction(async (tx) => {
				await tx.user.update({
					where: { id: purchaseUser.id },
					data: {
						discordConnected: false,
						discordConnectedAt: null,
					},
				});

				await tx.account.deleteMany({
					where: {
						userId: purchaseUser.id,
						providerId: "discord",
					},
				});

				await tx.discordAudit.create({
					data: {
						userId: purchaseUser.id,
						discordId,
						discordUsername: purchaseUser.discordUsername,
						action: "kicked",
						reason: "subscription_deleted",
						metadata: {
							cancellationReason,
							kickSuccess: kickResult.success,
							kickError: kickResult.error ?? null,
						},
					},
				});
			});
		} else {
			logger.info("   🎮 Changing Discord role to grace period", {
				discordId,
				cancellationReason: cancellationReason ?? "unknown",
			});

			const planRoleId = purchaseUser.discordRoleKey
				? resolvePlanRoleId(purchaseUser.discordRoleKey)
				: null;
			const result = await changeToGracePeriodRole(
				discordId,
				planRoleId ?? undefined,
			);

			if (result.success) {
				logger.info("   ✅ Discord role changed to grace period");
			} else {
				logger.error("   ❌ Discord role change failed", {
					userId: purchase.userId,
					discordId,
					error: result.error,
				});
			}
		}
	} else {
		logger.warn("   ⚠️  No Discord ID - skipping Discord role change");
	}

	const billingBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
	const reactivateUrl = billingBase
		? `${billingBase}/app/settings/billing`
		: "#";

	if (purchase.user.email) {
		logger.info("   📧 Sending cancellation confirmation email", {
			to: purchase.user.email,
		});

		await sendEmail({
			to: purchase.user.email,
			templateId: "subscriptionCanceled",
			context: {
				name: purchase.user.name,
				cancelledAt: new Date(),
				reactivateUrl,
			},
		})
			.then(() => {
				logger.info("   ✅ Cancellation confirmation email sent");
			})
			.catch((error) => {
				logger.error("   ❌ Failed to send cancellation email", {
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
			});
	} else {
		logger.warn("   ⚠️  No email address - skipping cancellation email");
	}

	const userLabel = purchase.user?.name || purchase.user?.email || "A user";

	await notifyAllAdmins({
		type: "subscription_access_ended",
		title: "Subscription Access Ended",
		message: `${userLabel}'s subscription period ended (Stripe subscription deleted).`,
	}).catch((error) => {
		logger.error("   ❌ Failed to notify admins", {
			error: error instanceof Error ? error.message : String(error),
		});
	});

	logger.info("✅ Subscription deleted handler complete", {
		eventId: event.id,
	});
}
