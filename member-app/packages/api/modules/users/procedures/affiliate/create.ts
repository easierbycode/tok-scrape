import { REWARDFUL_CONFIG } from "@repo/config/constants";
import { db, notifyAllAdmins } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import {
	createRewardfulAffiliate,
	fetchRewardfulCommissions,
	findRewardfulAffiliateByEmail,
	generateSlugFromName,
	type RewardfulAffiliateDetails,
} from "../../../../lib/rewardful-client";
import { rateLimitMiddleware } from "../../../../orpc/middleware/rate-limit-middleware";
import { protectedProcedure } from "../../../../orpc/procedures";

export const createAffiliate = protectedProcedure
	.use(rateLimitMiddleware({ limit: 5, windowMs: 60000 })) // 5 per minute
	.input(
		z.object({
			email: z.string().email(),
			agreedToTerms: z.boolean(),
		}),
	)
	.handler(async ({ input, context }) => {
		if (!input.agreedToTerms) {
			throw new Error("Must agree to terms");
		}

		// Check if this user already has an affiliate account in our database
		const existingInDb = await db.affiliate.findUnique({
			where: { userId: context.user.id },
		});

		if (existingInDb) {
			throw new Error("Already enrolled as affiliate");
		}

		// Parse user name
		const nameParts = context.user.name?.split(" ") || ["User"];
		const firstName = nameParts[0] || "User";
		const lastName = nameParts.slice(1).join(" ") || "";

		try {
			// STEP 1: Check if an affiliate already exists in Rewardful with this email
			const existingRewardfulAffiliate = await findRewardfulAffiliateByEmail(
				input.email,
			);

			let rewardfulAffiliate: RewardfulAffiliateDetails;
			let isExistingAffiliate = false;

			if (existingRewardfulAffiliate) {
				// EXISTING AFFILIATE: Link the existing Rewardful account to this user
				logger.info("Found existing Rewardful affiliate, linking to user", {
					rewardfulId: existingRewardfulAffiliate.id,
					email: input.email,
					userId: context.user.id,
				});

				// Check if this Rewardful account is already linked to another user
				const alreadyLinked = await db.affiliate.findUnique({
					where: { rewardfulId: existingRewardfulAffiliate.id },
				});

				if (alreadyLinked) {
					throw new Error(
						"This affiliate account is already connected to another user. Please contact support if you believe this is an error.",
					);
				}

				rewardfulAffiliate = existingRewardfulAffiliate;
				isExistingAffiliate = true;
			} else {
				// NEW AFFILIATE: Create a new affiliate in Rewardful
				const suggestedToken = generateSlugFromName(firstName, lastName);

				try {
					// Try with suggested token first
					rewardfulAffiliate = await createRewardfulAffiliate({
						email: input.email,
						firstName,
						lastName,
						campaignId: REWARDFUL_CONFIG.campaignId,
						token: suggestedToken || undefined,
					});
				} catch (error: any) {
					// If token is taken (422 error), retry without token
					if (
						error.message.includes("Token") ||
						error.message.includes("already")
					) {
						logger.info(
							"Token already taken, letting Rewardful generate one",
							{
								attemptedToken: suggestedToken,
								userId: context.user.id,
							},
						);

						// Retry without token - Rewardful will auto-generate a unique one
						rewardfulAffiliate = await createRewardfulAffiliate({
							email: input.email,
							firstName,
							lastName,
							campaignId: REWARDFUL_CONFIG.campaignId,
						});
					} else {
						throw error;
					}
				}
			}

			// Extract the token/slug and full URL from the first link
			const primaryLink = rewardfulAffiliate.links?.[0];
			const finalSlug =
				primaryLink?.token ||
				generateSlugFromName(firstName, lastName) ||
				`user-${context.user.id}`;
			const primaryLinkUrl = primaryLink?.url || null;

			// For existing affiliates, fetch their commission data to sync
			let commissionsData = {
				commissionsEarned: 0,
				commissionsPending: 0,
				commissionsPaid: 0,
			};

			if (isExistingAffiliate) {
				try {
					const commissions = await fetchRewardfulCommissions(
						rewardfulAffiliate.id,
					);
					commissionsData = {
						commissionsEarned: commissions.reduce((sum, c) => sum + c.amount, 0),
						commissionsPending: commissions
							.filter((c) => c.state === "pending")
							.reduce((sum, c) => sum + c.amount, 0),
						commissionsPaid: commissions
							.filter((c) => c.state === "paid")
							.reduce((sum, c) => sum + c.amount, 0),
					};
				} catch (err) {
					logger.warn("Failed to fetch commissions for existing affiliate", {
						rewardfulId: rewardfulAffiliate.id,
						error: err,
					});
				}
			}

			// Create local database record
			const affiliate = await db.affiliate.create({
				data: {
					userId: context.user.id,
					slug: finalSlug,
					primaryLinkUrl,
					status: rewardfulAffiliate.state === "active" ? "active" : "pending",
					rewardfulId: rewardfulAffiliate.id,
					visitors: rewardfulAffiliate.visitors || 0,
					leads: rewardfulAffiliate.leads || 0,
					conversions: rewardfulAffiliate.conversions || 0,
					...commissionsData,
					lastSyncAt: isExistingAffiliate ? new Date() : null,
					syncStatus: isExistingAffiliate ? "synced" : "never_synced",
				},
			});

			// Notify admins
			await notifyAllAdmins({
				type: "affiliate_new",
				title: isExistingAffiliate ? "Affiliate Linked" : "New Affiliate",
				message: isExistingAffiliate
					? `${context.user.name || context.user.email} connected their existing affiliate account`
					: `${context.user.name || context.user.email} enrolled in affiliate program`,
			});

			logger.info(
				isExistingAffiliate
					? "Existing affiliate linked successfully"
					: "Affiliate created successfully",
				{
					userId: context.user.id,
					affiliateId: affiliate.id,
					rewardfulId: rewardfulAffiliate.id,
					slug: finalSlug,
					isExisting: isExistingAffiliate,
				},
			);

			return {
				success: true,
				affiliateId: affiliate.id,
				slug: finalSlug,
				message: isExistingAffiliate
					? "Existing affiliate account connected successfully! Your previous earnings and referrals have been synced."
					: "Affiliate account created successfully",
				isExistingAffiliate,
			};
		} catch (error: any) {
			logger.error("Failed to create/link affiliate", {
				userId: context.user.id,
				error: error.message,
			});

			// Return user-friendly error
			throw new Error(
				error.message.includes("already connected")
					? error.message
					: error.message.includes("Rewardful")
						? "Failed to connect with affiliate platform. Please try again."
						: error.message,
			);
		}
	});
