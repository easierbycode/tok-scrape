/**
 * Discord integration helper
 *
 * Checks user's subscription status and grants appropriate Discord role
 */

import { db, notifyAllAdmins } from "@repo/database";
import {
	getActiveSubscription,
	getLifetimePurchase,
	getManualOverride,
} from "@repo/database/prisma/queries/access";
import { getUserById } from "@repo/database/prisma/queries/users";
import {
	addUserToServer,
	changeToGracePeriodRole,
	type DiscordResult,
	grantActiveRole,
	resolvePlanRoleId,
	swapPlanRole,
} from "@repo/discord";
import { getActiveRoleId } from "@repo/discord/lib/helpers";
import { logger } from "@repo/logs";

async function resolvePlanRoleFromPurchase(
	productId: string | null | undefined,
): Promise<{ roleId: string; envKey: string } | null> {
	if (!productId) {
		return null;
	}
	const plan = await db.marketingPricingPlan.findFirst({
		where: { stripePriceId: productId },
	});
	if (!plan?.discordRoleEnvKey) {
		return null;
	}
	const roleId = resolvePlanRoleId(plan.discordRoleEnvKey);
	if (!roleId) {
		return null;
	}
	return { roleId, envKey: plan.discordRoleEnvKey };
}

function getKnownPlanRoleIdsForSwap(): string[] {
	const activeRoleId = getActiveRoleId();
	const starterId = resolvePlanRoleId("DISCORD_STARTER_ROLE_ID");
	const creatorId = resolvePlanRoleId("DISCORD_CREATOR_ROLE_ID");
	const streamerId = resolvePlanRoleId("DISCORD_STREAMER_ROLE_ID");
	const partnerId = resolvePlanRoleId("DISCORD_PARTNER_ROLE_ID");
	const gracePeriodId = resolvePlanRoleId("DISCORD_GRACE_PERIOD_ROLE_ID");
	const ids = [activeRoleId, starterId, creatorId, streamerId, partnerId, gracePeriodId].filter(
		(id): id is string => Boolean(id),
	);
	return [...new Set(ids)];
}

/**
 * Check user's access status and grant appropriate Discord role
 *
 * Called after:
 * - Discord OAuth completes
 * - Subscription webhook processes
 * - Admin grants access
 *
 * Flow:
 * 1. Get user + purchases
 * 2. Check has discordId
 * 3. Check has active subscription
 * 4. Determine role (active vs grace period)
 * 5. Grant appropriate Discord role
 */
export async function checkAndGrantDiscordAccess(
	userId: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		// Initialize Discord client if not already initialized
		if (!process.env.DISCORD_BOT_TOKEN) {
			logger.warn(
				"Discord bot token not configured, skipping Discord access grant",
			);
			return { success: false, error: "Discord bot not configured" };
		}

		// Get user from database
		const user = await getUserById(userId);
		if (!user) {
			return { success: false, error: "User not found" };
		}

		// Check if user has Discord connected
		if (!user.discordId) {
			logger.info("User does not have Discord connected", { userId });
			return { success: false, error: "User has not connected Discord" };
		}

		// Get user's active subscription, manual override, or lifetime purchase
		const activeSubscription = await getActiveSubscription(userId);
		const manualOverride = await getManualOverride(userId);
		const lifetimePurchase = await getLifetimePurchase(userId);

		// Determine subscription status
		const hasActiveAccess =
			!!activeSubscription || !!manualOverride || !!lifetimePurchase;
		const isGracePeriod = activeSubscription?.status === "grace_period";

		if (!hasActiveAccess) {
			logger.info("User does not have active access", { userId });
			return {
				success: false,
				error: "User does not have active subscription or manual override",
			};
		}

		// Get Discord access token from Account table
		// Better-Auth stores OAuth tokens in the Account table
		const discordAccount = await db.account.findFirst({
			where: {
				userId,
				providerId: "discord",
			},
		});

		if (!discordAccount?.accessToken) {
			logger.warn("Discord access token not found for user", { userId });
			// Still try to grant role if user is already in server
		}

		// If user is not in server yet and we have access token, add them
		if (discordAccount?.accessToken) {
			const addResult = await addUserToServer(
				userId,
				discordAccount.accessToken,
				{
					discordId: user.discordId,
					username: user.discordUsername || user.discordId,
					accessToken: discordAccount.accessToken,
				},
			);

			if (!addResult.success && addResult.error?.includes("already")) {
				// User already in server, continue to role assignment
				logger.info("User already in Discord server", { userId });
			} else if (!addResult.success) {
				// Notify admins of Discord error
				await notifyAllAdmins({
					type: "discord_error",
					title: "Discord Integration Error",
					message: `Failed to add user ${userId} to Discord server: ${addResult.error || "Unknown error"}`,
				}).catch((notifError) => {
					logger.error("Failed to notify admins of Discord error", {
						notifError,
					});
				});
				return addResult;
			}
		}

		const activePurchase = await db.purchase.findFirst({
			where: {
				userId,
				status: { in: ["active", "grace_period"] },
			},
			orderBy: { createdAt: "desc" },
		});

		const planResolved = activePurchase?.productId
			? await resolvePlanRoleFromPurchase(activePurchase.productId)
			: null;

		// Grant appropriate role based on subscription status
		if (isGracePeriod) {
			const planRoleToStrip = user.discordRoleKey
				? resolvePlanRoleId(user.discordRoleKey)
				: undefined;
			const result = await changeToGracePeriodRole(
				user.discordId,
				planRoleToStrip ?? undefined,
			);
			if (!result.success) {
				// Notify admins of Discord error
				await notifyAllAdmins({
					type: "discord_error",
					title: "Discord Integration Error",
					message: `Failed to grant grace period role to user ${userId}: ${result.error || "Unknown error"}`,
				}).catch((notifError) => {
					logger.error("Failed to notify admins of Discord error", {
						notifError,
					});
				});
				return result;
			}
		} else {
			let result: DiscordResult;
			if (planResolved) {
				const oldRoleIds = getKnownPlanRoleIdsForSwap();
				result = await swapPlanRole(
					user.discordId,
					oldRoleIds,
					planResolved.roleId,
				);
			} else {
				result = await grantActiveRole(user.discordId);
			}
			if (!result.success) {
				// Notify admins of Discord error
				await notifyAllAdmins({
					type: "discord_error",
					title: "Discord Integration Error",
					message: `Failed to grant active role to user ${userId}: ${result.error || "Unknown error"}`,
				}).catch((notifError) => {
					logger.error("Failed to notify admins of Discord error", {
						notifError,
					});
				});
				return result;
			}
		}

		// Update user's Discord connected status
		await db.user.update({
			where: { id: userId },
			data: {
				discordConnected: true,
				discordConnectedAt: new Date(),
				...(isGracePeriod
					? {}
					: {
							discordRoleKey: planResolved
								? planResolved.envKey
								: "DISCORD_ACTIVE_ROLE_ID",
						}),
			},
		});

		logger.info("Discord access granted successfully", {
			userId,
			discordId: user.discordId,
			role: isGracePeriod ? "grace_period" : "active",
		});

		return { success: true };
	} catch (error) {
		logger.error("Error checking and granting Discord access", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});

		// Notify admins of Discord error
		await notifyAllAdmins({
			type: "discord_error",
			title: "Discord Integration Error",
			message: `Failed Discord operation for user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`,
		}).catch((notifError) => {
			// Don't throw if notification fails - log it
			logger.error("Failed to notify admins of Discord error", {
				notifError,
			});
		});

		return {
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Unknown error occurred",
		};
	}
}
