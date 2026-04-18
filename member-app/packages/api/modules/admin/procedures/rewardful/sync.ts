import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { RateLimiter } from "../../../../lib/rate-limiter";
import { getCachedRewardfulAffiliates } from "../../../../lib/rewardful-cache";
import { fetchRewardfulCommissions } from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

const SyncRewardfulInput = z
	.object({
		forceRefresh: z.boolean().default(false),
	})
	.optional();

export const syncRewardful = adminProcedure
	.route({
		method: "POST",
		path: "/admin/rewardful/sync",
		tags: ["Administration"],
		summary: "Sync affiliates from Rewardful API with commission data",
	})
	.input(SyncRewardfulInput)
	.handler(async ({ input, context }) => {
		const { forceRefresh = false } = input || {};
		const { requestId } = context;

		logger.info("Starting Rewardful sync", { requestId, forceRefresh });

		// Fetch affiliate list (1 API call)
		const { affiliates } = await getCachedRewardfulAffiliates(forceRefresh);

		// Get all affiliates from database
		const dbAffiliates = await db.affiliate.findMany({
			include: {
				user: {
					select: {
						id: true,
						email: true,
						name: true,
					},
				},
			},
		});

		// Rate limiter: 45 requests per 30 seconds
		const rateLimiter = new RateLimiter(45, 30000);

		const syncResults = {
			synced: 0,
			errors: 0,
			total: affiliates.length,
		};

		// Process each affiliate with rate limiting
		for (let i = 0; i < affiliates.length; i++) {
			const rAffiliate = affiliates[i];
			const dbAffiliate = dbAffiliates.find(
				(a) => a.rewardfulId === rAffiliate.id,
			);

			try {
				// Wait for rate limit if needed
				await rateLimiter.wait();

				// Fetch commissions for this affiliate (1 API call per affiliate)
				const commissions = await fetchRewardfulCommissions(
					rAffiliate.id,
				);

				// Calculate commission totals
				const totalEarnings = commissions.reduce(
					(sum, c) => sum + c.amount,
					0,
				);
				const pendingEarnings = commissions
					.filter((c) => c.state === "pending")
					.reduce((sum, c) => sum + c.amount, 0);
				const paidEarnings = commissions
					.filter((c) => c.state === "paid")
					.reduce((sum, c) => sum + c.amount, 0);

				if (dbAffiliate) {
					// Update existing affiliate
					await db.affiliate.update({
						where: { id: dbAffiliate.id },
						data: {
							status:
								rAffiliate.state === "active"
									? "active"
									: rAffiliate.state === "suspended"
										? "suspended"
										: "inactive",
							visitors: rAffiliate.visitors,
							leads: rAffiliate.leads,
							conversions: rAffiliate.conversions,
							commissionsEarned: totalEarnings,
							commissionsPending: pendingEarnings,
							commissionsPaid: paidEarnings,
							lastSyncAt: new Date(),
							syncStatus: "synced",
							lastSyncError: null,
						},
					});
				} else {
					// New affiliate - would create but need userId
					logger.warn("Affiliate in Rewardful but not in DB", {
						rewardfulId: rAffiliate.id,
						email: rAffiliate.email,
					});
				}

				syncResults.synced++;

				// Log progress every 10 affiliates
				if ((i + 1) % 10 === 0 || i === affiliates.length - 1) {
					logger.info("Sync progress", {
						progress: `${i + 1}/${affiliates.length}`,
						rateLimitStatus: rateLimiter.getStatus(),
					});
				}
			} catch (error) {
				syncResults.errors++;
				logger.error("Failed to sync affiliate", {
					rewardfulId: rAffiliate.id,
					email: rAffiliate.email,
					error: error instanceof Error ? error.message : error,
				});

				// Mark error in DB if exists
				if (dbAffiliate) {
					await db.affiliate.update({
						where: { id: dbAffiliate.id },
						data: {
							syncStatus: "error",
							lastSyncError:
								error instanceof Error
									? error.message
									: "Unknown error",
						},
					});
				}
			}
		}

		// Log admin action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "affiliate",
			targetId: "all",
			summary: `Rewardful affiliate sync: ${syncResults.synced} synced, ${syncResults.errors} errors (${syncResults.total} total)`,
			metadata: {
				action: "SYNC_AFFILIATES",
				synced: syncResults.synced,
				errors: syncResults.errors,
				total: syncResults.total,
				requestId,
			},
		});

		logger.info("Rewardful sync completed", {
			requestId,
			syncResults,
		});

		return {
			success: true,
			syncResults,
			timestamp: new Date().toISOString(),
		};
	});
