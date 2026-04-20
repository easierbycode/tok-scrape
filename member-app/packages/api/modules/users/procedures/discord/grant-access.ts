/**
 * Grant Discord Access Procedure
 *
 * Called after Discord OAuth to:
 * 1. Validate Account row and user rules
 * 2. Require active access before marking discordConnected or adding to server
 * 3. Sync Discord data to User table
 * 4. Add user to Discord server (REST) and grant roles via shared helper
 */

import { db } from "@repo/database";
import {
	getActiveSubscription,
	getLifetimePurchase,
	getManualOverride,
} from "@repo/database/prisma/queries/access";
import { addUserToServer, getDiscordBotUserAgent } from "@repo/discord";
import { logger } from "@repo/logs";
import { checkAndGrantDiscordAccess } from "../../../../lib/discord-helper";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";

export const grantDiscordAccess = protectedProcedure
	.use(rateLimitMiddleware({ limit: 10, windowMs: 60000 })) // 10 per minute
	.handler(async ({ context }) => {
		const userId = context.user.id;
		logger.info("Attempting to grant Discord access", { userId });

		try {
			// Step 1: Find the Discord account from Better-Auth's Account table
			const discordAccount = await db.account.findFirst({
				where: {
					userId,
					providerId: "discord",
				},
			});

			if (!discordAccount) {
				logger.info("No Discord account found for user", { userId });
				return {
					success: false,
					error: "Discord not connected yet",
					needsConnection: true,
				};
			}

			const discordId = discordAccount.accountId;

			// Step 2: Fetch Discord username from Discord API
			let discordUsername: string | null = null;
			if (discordAccount.accessToken) {
				try {
					const discordUserResponse = await fetch(
						"https://discord.com/api/v10/users/@me",
						{
							headers: {
								Authorization: `Bearer ${discordAccount.accessToken}`,
								"User-Agent": getDiscordBotUserAgent(),
							},
						},
					);

					if (discordUserResponse.ok) {
						const discordUser = await discordUserResponse.json();
						discordUsername =
							discordUser.username ||
							discordUser.global_name ||
							null;
						logger.info("Fetched Discord username", {
							userId,
							discordUsername,
						});
					} else {
						logger.warn("Failed to fetch Discord username", {
							userId,
							status: discordUserResponse.status,
						});
					}
				} catch (error) {
					logger.error("Error fetching Discord username", {
						userId,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}

			const user = await db.user.findUnique({
				where: { id: userId },
			});

			if (!user) {
				return {
					success: false,
					error: "User not found",
				};
			}

			if (user.discordBanned) {
				logger.warn("Banned user attempted to connect Discord", {
					userId: user.id,
					email: user.email,
					banReason: user.discordBanReason,
				});

				return {
					success: false,
					error: "Your Discord connection has been disabled by an administrator. Please contact support for assistance.",
					banned: true,
				};
			}

			if (user.discordId && user.discordId !== discordId) {
				logger.warn(
					"User attempting to connect different Discord account",
					{
						userId,
						existingDiscordId: user.discordId,
						newDiscordId: discordId,
					},
				);

				return {
					success: false,
					error: `You already have Discord connected as ${user.discordUsername || "another account"}. Please leave the Discord server first to connect a different account.`,
					currentDiscordId: user.discordId,
				};
			}

			const existingUser = await db.user.findFirst({
				where: {
					discordId: discordId,
					NOT: { id: userId },
				},
			});

			if (existingUser) {
				logger.warn(
					"Discord account already connected to another user",
					{
						discordId,
						existingUserId: existingUser.id,
						attemptingUserId: userId,
					},
				);

				return {
					success: false,
					error: "This Discord account is already connected to another user account.",
				};
			}

			// Step 3: Access gate — same basis as checkAndGrantDiscordAccess
			const activeSubscription = await getActiveSubscription(userId);
			const manualOverride = await getManualOverride(userId);
			const lifetimePurchase = await getLifetimePurchase(userId);
			const hasActiveAccess =
				!!activeSubscription || !!manualOverride || !!lifetimePurchase;

			if (!hasActiveAccess) {
				logger.info(
					"User completed Discord OAuth but has no active access — not marking connected",
					{ userId },
				);
				await db.user.update({
					where: { id: userId },
					data: {
						discordId,
						discordUsername,
						discordConnected: false,
						discordConnectedAt: null,
					},
				});

				return {
					success: false,
					noSubscription: true,
					error: "An active subscription or eligible access is required to connect Discord to the community server.",
				};
			}

			// Step 4: Sync Discord data and mark connected (only with access)
			await db.user.update({
				where: { id: userId },
				data: {
					discordId,
					discordUsername,
					discordConnected: true,
					discordConnectedAt: new Date(),
				},
			});

			logger.info("Synced Discord data to user", {
				userId,
				discordId,
				discordUsername,
			});

			if (!process.env.DISCORD_BOT_TOKEN) {
				logger.warn(
					"Discord bot token not configured, skipping server add",
				);
				return {
					success: true,
					message: "Discord synced but bot not configured",
				};
			}

			if (discordAccount.accessToken) {
				const userForAdd = await db.user.findUnique({
					where: { id: userId },
					select: { discordUsername: true },
				});

				const addResult = await addUserToServer(
					userId,
					discordAccount.accessToken,
					{
						discordId: discordId,
						username: userForAdd?.discordUsername || discordId,
						accessToken: discordAccount.accessToken,
					},
				);

				if (!addResult.success) {
					if (
						addResult.error?.includes("already") ||
						addResult.error?.includes("Already")
					) {
						logger.info("User already in Discord server", {
							userId,
							discordId,
						});
					} else {
						logger.error("Failed to add user to Discord server", {
							userId,
							discordId,
							error: addResult.error,
						});
						return {
							success: true,
							warning: `Discord connected but server add failed: ${addResult.error}`,
						};
					}
				} else {
					logger.info("Added user to Discord server", {
						userId,
						discordId,
					});
				}
			}

			const accessResult = await checkAndGrantDiscordAccess(userId);
			if (!accessResult.success) {
				logger.error("Failed to grant Discord roles after connect", {
					userId,
					discordId,
					error: accessResult.error,
				});
				return {
					success: true,
					warning: `Connected but role grant failed: ${accessResult.error}`,
				};
			}

			logger.info("Discord access fully granted", {
				userId,
				discordId,
			});

			return { success: true };
		} catch (error) {
			logger.error("Error in grantDiscordAccess", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return { success: false, error: "Failed to grant Discord access" };
		}
	});
