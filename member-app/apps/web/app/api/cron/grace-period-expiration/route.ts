import { db } from "@repo/database";
import { removeUserFromServer } from "@repo/discord";
import { logger } from "@repo/logs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

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

		logger.info("Starting grace period expiration check");

		// Find all purchases in grace_period that have expired
		const expiredPurchases = await db.purchase.findMany({
			where: {
				status: "grace_period",
				currentPeriodEnd: {
					lt: new Date(),
				},
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						notificationEmail: true,
						stripeEmail: true,
						discordId: true,
						discordUsername: true,
						discordConnected: true,
					},
				},
			},
		});

		logger.info(
			`Found ${expiredPurchases.length} expired grace period purchases`,
		);

		let processed = 0;
		let errors = 0;

		for (const purchase of expiredPurchases) {
			try {
				if (!purchase.userId) {
					continue;
				}

				// Update purchase to cancelled
				await db.purchase.update({
					where: { id: purchase.id },
					data: {
						status: "cancelled",
						cancelledAt: new Date(),
					},
				});

				// Remove from Discord if connected
				if (
					purchase.user?.discordId &&
					purchase.user.discordConnected
				) {
					const kickResult = await removeUserFromServer(
						purchase.user.discordId,
					);

					if (kickResult.success) {
						// Update user
						await db.user.update({
							where: { id: purchase.userId },
							data: {
								discordConnected: false,
								discordConnectedAt: null,
							},
						});

						// Create audit log
						await db.discordAudit.create({
							data: {
								userId: purchase.userId,
								discordId: purchase.user.discordId,
								discordUsername: purchase.user.discordUsername,
								action: "kicked",
								reason: "grace_period_expired",
								metadata: { purchaseId: purchase.id },
							},
						});

						logger.info(
							"User removed from Discord after grace period expiration",
							{
								userId: purchase.userId,
								discordId: purchase.user.discordId,
							},
						);
					} else {
						logger.error("Failed to remove user from Discord", {
							userId: purchase.userId,
							discordId: purchase.user.discordId,
							error: kickResult.error,
						});
						errors++;
					}
				}

				// Create user notification
				await db.notification.create({
					data: {
						userId: purchase.userId,
						type: "error",
						title: "Subscription Cancelled",
						message:
							"Your grace period has expired. Please resubscribe to regain access.",
					},
				});

				// Send "Subscription Cancelled" email
				if (purchase.user) {
					try {
						const { sendEmail } = await import("@repo/mail");
						await sendEmail({
							to:
								purchase.user.notificationEmail ||
								purchase.user.stripeEmail ||
								purchase.user.email ||
								"",
							templateId: "subscriptionCanceled",
							context: {
								name: purchase.user.name || "there",
								cancelledAt: new Date(),
								reactivateUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.example.com"}/choose-plan`,
							},
						});
					} catch (error) {
						logger.error(
							"Failed to send subscription cancelled email",
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

				processed++;
			} catch (error) {
				logger.error("Error processing expired purchase", {
					purchaseId: purchase.id,
					userId: purchase.userId,
					error:
						error instanceof Error ? error.message : String(error),
				});
				errors++;
			}
		}

		logger.info("Grace period expiration check complete", {
			total: expiredPurchases.length,
			processed,
			errors,
		});

		return NextResponse.json({
			success: true,
			processed,
			errors,
			total: expiredPurchases.length,
		});
	} catch (error) {
		logger.error("Grace period cron job failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
