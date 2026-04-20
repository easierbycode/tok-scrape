/**
 * Discord OAuth Callback Handler
 *
 * Called by Better-Auth after successful Discord OAuth connection.
 * Updates user's Discord info in the database.
 *
 * Note: Discord role granting is handled separately via checkAndGrantDiscordAccess()
 * which should be called from the API layer to avoid circular dependencies.
 */

import { db } from "@repo/database";
import { logger } from "@repo/logs";

/**
 * Handle Discord OAuth callback
 *
 * Persists discordId from the OAuth account; discordConnected is set by grantDiscordAccess after access checks.
 *
 * This is called asynchronously from the auth hook to not block the OAuth callback.
 * The actual Discord role granting is handled by checkAndGrantDiscordAccess()
 * which is called from the frontend after OAuth redirect completes.
 */
export async function handleDiscordOAuthCallback(
	userId: string,
): Promise<void> {
	try {
		logger.info("Processing Discord OAuth callback", { userId });

		// Get the Discord account data that was just linked
		const discordAccount = await db.account.findFirst({
			where: {
				userId,
				providerId: "discord",
			},
		});

		if (!discordAccount) {
			logger.warn("Discord account not found after OAuth callback", {
				userId,
			});
			return;
		}

		// Extract Discord user info from the account
		// Better-Auth stores the provider's user ID in accountId
		const discordId = discordAccount.accountId;

		// Get the full user to check if we need to update Discord info
		const user = await db.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			logger.error("User not found after Discord OAuth", { userId });
			return;
		}

		// Persist Discord user id only; discordConnected is set by grantDiscordAccess
		// after subscription/access checks (serverless-safe, single source of truth).
		if (user.discordId !== discordId) {
			await db.user.update({
				where: { id: userId },
				data: {
					discordId,
				},
			});

			logger.info(
				"Updated user discordId after OAuth (connection pending grant)",
				{
					userId,
					discordId,
				},
			);
		} else {
			logger.info("User Discord id already up to date", {
				userId,
				discordId,
			});
		}

		// Note: Discord role granting is handled by:
		// 1. The frontend calling an API endpoint after OAuth redirect
		// 2. Subscription webhooks when user subscribes
		// 3. Admin manual access grants
		// This avoids circular dependencies between auth and api packages.
	} catch (error) {
		logger.error("Error in handleDiscordOAuthCallback", {
			userId,
			error: error instanceof Error ? error.message : String(error),
		});
		// Don't rethrow - we don't want to break OAuth flow
	}
}
