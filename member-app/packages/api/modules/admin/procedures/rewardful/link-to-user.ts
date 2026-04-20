import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import {
	fetchRewardfulAffiliateDetails,
	fetchRewardfulCommissions,
	findRewardfulAffiliateByEmail,
	type RewardfulAffiliateDetails,
} from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

const LinkToUserInput = z.object({
	// Option 1: Provide email - will find both user and Rewardful affiliate by email
	email: z.string().email().optional(),
	// Option 2: Provide both IDs directly (legacy support)
	rewardfulId: z.string().optional(),
	userId: z.string().optional(),
});

export const linkToUser = adminProcedure
	.route({
		method: "POST",
		path: "/admin/rewardful/link-to-user",
		tags: ["Administration"],
		summary: "Link existing Rewardful affiliate to user account (by email or IDs)",
	})
	.input(LinkToUserInput)
	.handler(async ({ input, context }) => {
		let { email, rewardfulId, userId } = input;

		// Validate input - need either email OR both IDs
		if (!email && (!rewardfulId || !userId)) {
			throw new Error(
				"Provide either 'email' to auto-find both, or both 'rewardfulId' and 'userId'",
			);
		}

		let user;
		let rAffiliate: RewardfulAffiliateDetails;

		if (email) {
			// EMAIL-BASED LINKING: Find both user and Rewardful affiliate by email
			logger.info("Admin linking affiliate by email", { email });

			// Find user by email
			user = await db.user.findUnique({ where: { email } });
			if (!user) {
				throw new Error(`No user found with email: ${email}`);
			}

			// Check if user already has an affiliate
			const existingUserAffiliate = await db.affiliate.findUnique({
				where: { userId: user.id },
			});
			if (existingUserAffiliate) {
				throw new Error(
					`User ${email} already has an affiliate account linked (Rewardful ID: ${existingUserAffiliate.rewardfulId})`,
				);
			}

			// Find Rewardful affiliate by email (returns details with links)
			const foundAffiliate = await findRewardfulAffiliateByEmail(email);
			if (!foundAffiliate) {
				throw new Error(`No Rewardful affiliate found with email: ${email}`);
			}
			rAffiliate = foundAffiliate;

			// Check if this Rewardful account is already linked to another user
			const existingRewardfulLink = await db.affiliate.findUnique({
				where: { rewardfulId: rAffiliate.id },
			});
			if (existingRewardfulLink) {
				const linkedUser = await db.user.findUnique({
					where: { id: existingRewardfulLink.userId },
				});
				throw new Error(
					`This Rewardful account is already linked to user: ${linkedUser?.email || existingRewardfulLink.userId}`,
				);
			}

			rewardfulId = rAffiliate.id;
			userId = user.id;
		} else {
			// ID-BASED LINKING: Use provided IDs (legacy)
			user = await db.user.findUnique({ where: { id: userId } });
			if (!user) {
				throw new Error("User not found");
			}

			// Check if affiliate record already exists
			const existing = await db.affiliate.findUnique({
				where: { rewardfulId },
			});
			if (existing) {
				throw new Error("Affiliate already linked to a user");
			}

			// Fetch affiliate details from Rewardful by ID (includes links)
			rAffiliate = await fetchRewardfulAffiliateDetails(rewardfulId!);
		}

		// Fetch commissions
		const commissions = await fetchRewardfulCommissions(rewardfulId!);

		// Calculate totals
		const totalEarnings = commissions.reduce((sum, c) => sum + c.amount, 0);
		const pendingEarnings = commissions
			.filter((c) => c.state === "pending")
			.reduce((sum, c) => sum + c.amount, 0);
		const paidEarnings = commissions
			.filter((c) => c.state === "paid")
			.reduce((sum, c) => sum + c.amount, 0);

		// Get token/slug from links if available
		const slug =
			rAffiliate.links?.[0]?.token || rAffiliate.email.split("@")[0];

		// Create affiliate record
		const affiliate = await db.affiliate.create({
			data: {
				userId: userId!,
				rewardfulId: rewardfulId!,
				slug,
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
			},
		});

		logger.info("Admin linked affiliate to user", {
			rewardfulId,
			userId,
			userEmail: user.email,
			adminId: context.user.id,
			method: email ? "email" : "ids",
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "LINK_AFFILIATE",
			targetType: "affiliate",
			targetId: affiliate.id,
			summary: `Linked Rewardful affiliate ${slug} to ${user.email}`,
			metadata: {
				rewardfulId: rewardfulId!,
				userId: userId!,
				userEmail: user.email,
				slug,
			},
		});

		return {
			success: true,
			message: `Successfully linked Rewardful affiliate to ${user.email}`,
			affiliate: {
				id: affiliate.id,
				rewardfulId: rewardfulId!,
				slug,
				userName: user.name,
				userEmail: user.email,
				stats: {
					visitors: rAffiliate.visitors,
					leads: rAffiliate.leads,
					conversions: rAffiliate.conversions,
					totalEarnings: totalEarnings / 100,
					pendingEarnings: pendingEarnings / 100,
					paidEarnings: paidEarnings / 100,
				},
			},
		};
	});
