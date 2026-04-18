import { config } from "@repo/config";
import { MANUAL_OVERRIDE_PRODUCT_ID } from "@repo/config/constants";
import { db } from "@repo/database";
import { z } from "zod";
import { adminProcedure } from "../../../orpc/procedures";

export const listUsers = adminProcedure
	.route({
		method: "GET",
		path: "/admin/users",
		tags: ["Administration"],
		summary: "List users with enriched data",
	})
	.input(
		z.object({
			searchTerm: z.string().max(100).trim().optional(),
			subscriptionStatus: z
				.enum([
					"active",
					"cancelled",
					"grace_period",
					"scheduled_cancel",
					"none",
					"manual",
					"trial",
					"lifetime",
				])
				.optional(),
			discordConnected: z.boolean().optional(),
			role: z
				.enum(["owner", "analytics_viewer", "admin", "support", "user"])
				.optional(),
			itemsPerPage: z.number().int().positive().max(100).default(10),
			currentPage: z.number().int().positive().default(1),
		}),
	)
	.handler(async ({ input }) => {
		const {
			searchTerm,
			subscriptionStatus,
			discordConnected,
			role,
			itemsPerPage,
			currentPage,
		} = input;

		// Build Prisma where clause
		const whereClause: any = {
			AND: [{ deletedAt: null }],
		};

		// Search filter
		if (searchTerm) {
			whereClause.AND.push({
				OR: [
					{ name: { contains: searchTerm, mode: "insensitive" } },
					{ email: { contains: searchTerm, mode: "insensitive" } },
				],
			});
		}

		if (role) {
			if (role === "user") {
				whereClause.AND.push({
					OR: [{ role: null }, { role: "user" }],
				});
			} else {
				whereClause.AND.push({ role });
			}
		}

		// If no filters, remove empty AND array
		if (whereClause.AND.length === 0) {
			delete whereClause.AND;
		}

		// Query users with relations
		const users = await db.user.findMany({
			where:
				Object.keys(whereClause).length > 0 ? whereClause : undefined,
			include: {
				purchases: {
					orderBy: { createdAt: "desc" },
				},
				accounts: {
					select: {
						providerId: true,
						createdAt: true,
					},
				},
				sessions: {
					orderBy: { createdAt: "desc" },
					take: 10,
					select: {
						createdAt: true,
						ipAddress: true,
						userAgent: true,
					},
				},
				affiliateProfile: {
					select: {
						id: true,
						rewardfulId: true,
						slug: true,
						status: true,
						primaryLinkUrl: true,
						visitors: true,
						leads: true,
						conversions: true,
						commissionsEarned: true,
						commissionsPending: true,
						commissionsPaid: true,
						lastSyncAt: true,
						syncStatus: true,
						createdAt: true,
					},
				},
				_count: {
					select: {
						sessions: true,
					},
				},
			},
			take: itemsPerPage,
			skip: (currentPage - 1) * itemsPerPage,
			orderBy: { createdAt: "desc" },
		});

		// Helper to derive a human-readable plan label from a purchase
		function getPlanLabel(
			p: (typeof users)[number]["purchases"][number],
		): string {
			if (p.productId === MANUAL_OVERRIDE_PRODUCT_ID)
				return "Manual Access";

			for (const [planKey, plan] of Object.entries(
				config.payments.plans,
			)) {
				if (!("prices" in plan) || !plan.prices) continue;
				const matchedPrice = plan.prices.find(
					(price) => price.productId === p.productId,
				);
				if (matchedPrice) {
					const label =
						planKey.charAt(0).toUpperCase() +
						planKey.slice(1).replace(/_/g, " ");
					if (matchedPrice.type === "one-time")
						return `${label} (Lifetime)`;
					const intervalLabel =
						matchedPrice.type === "recurring"
							? matchedPrice.interval
							: null;
					return intervalLabel
						? `${label} (${intervalLabel}ly)`
						: label;
				}
			}

			if (p.type === "ONE_TIME") return "Lifetime";
			if (p.cachedInterval === "year") return "Yearly";
			if (p.cachedInterval === "month") return "Monthly";
			return "Subscription";
		}

		// Compute enriched fields
		const enrichedUsers = users.map((user) => {
			const activePurchases = user.purchases.filter(
				(p) => p.status === "active",
			);

			const hasManualAccess = activePurchases.some(
				(p) => p.productId === MANUAL_OVERRIDE_PRODUCT_ID,
			);
			const hasLifetime = activePurchases.some(
				(p) =>
					p.type === "ONE_TIME" &&
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID,
			);
			const hasStripeSub = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION",
			);
			const hasCancelledSub = user.purchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.status === "cancelled",
			);
			const hasTrial = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.trialEnd &&
					new Date(p.trialEnd) > new Date(),
			);
			const gracePeriodPurchase = user.purchases.find(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.status === "grace_period",
			);
			const hasPaymentGracePeriod = Boolean(gracePeriodPurchase);
			// Stripe maps both cancel_at_period_end and flexible-billing cancel_at
			// onto Purchase.cancelAtPeriodEnd (see handleSubscriptionCancelAtPeriodEndSet).
			const hasScheduledCancel = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.cancelAtPeriodEnd === true &&
					p.currentPeriodEnd &&
					new Date(p.currentPeriodEnd) > new Date(),
			);

			let subscriptionStatus:
				| "active"
				| "cancelled"
				| "grace_period"
				| "scheduled_cancel"
				| "none"
				| "manual"
				| "trial"
				| "lifetime";
			if (hasManualAccess) {
				subscriptionStatus = "manual";
			} else if (hasLifetime) {
				subscriptionStatus = "lifetime";
			} else if (hasTrial) {
				subscriptionStatus = "trial";
			} else if (hasPaymentGracePeriod) {
				subscriptionStatus = "grace_period";
			} else if (hasScheduledCancel) {
				subscriptionStatus = "scheduled_cancel";
			} else if (hasCancelledSub) {
				subscriptionStatus = "cancelled";
			} else if (hasStripeSub) {
				subscriptionStatus = "active";
			} else {
				subscriptionStatus = "none";
			}

			// Active purchase for subscription details
			const activePurchase =
				activePurchases.find(
					(p) =>
						p.type === "SUBSCRIPTION" &&
						p.productId !== MANUAL_OVERRIDE_PRODUCT_ID,
				) ||
				activePurchases.find(
					(p) =>
						p.type === "ONE_TIME" &&
						p.productId !== MANUAL_OVERRIDE_PRODUCT_ID,
				) ||
				activePurchases.find(
					(p) => p.productId === MANUAL_OVERRIDE_PRODUCT_ID,
				) || gracePeriodPurchase;

			return {
				id: user.id,
				name: user.name,
				email: user.email,
				stripeEmail: user.stripeEmail || undefined,
				notificationEmail: user.notificationEmail || undefined,
				subscriptionStatus,
				planLabel: activePurchase
					? getPlanLabel(activePurchase)
					: undefined,
			discordConnected: user.discordConnected,
				discordId: user.discordId || undefined,
				discordRoleKey: user.discordRoleKey || null,
				discordBanned: user.discordBanned || false,
				role: user.role || null,
				joinedAt: user.createdAt.toISOString(),
				avatar: user.image || undefined,
				image: user.image || undefined,
				emailVerified: !!user.emailVerified,
				lastLogin:
					user.sessions[0]?.createdAt?.toISOString() || undefined,
				loginCount: user._count.sessions,
				referredBySlug: user.referredBySlug || undefined,
				betaFeatures: user.betaFeatures || [],
				isAffiliate: !!user.affiliateProfile,
				affiliateData: user.affiliateProfile
					? {
							id: user.affiliateProfile.id,
							rewardfulId: user.affiliateProfile.rewardfulId,
							slug: user.affiliateProfile.slug,
							status: user.affiliateProfile.status,
							primaryLinkUrl:
								user.affiliateProfile.primaryLinkUrl ||
								undefined,
							visitors: user.affiliateProfile.visitors,
							leads: user.affiliateProfile.leads,
							conversions: user.affiliateProfile.conversions,
							commissionsEarned:
								user.affiliateProfile.commissionsEarned,
							commissionsPending:
								user.affiliateProfile.commissionsPending,
							commissionsPaid:
								user.affiliateProfile.commissionsPaid,
							lastSyncAt:
								user.affiliateProfile.lastSyncAt?.toISOString() ||
								undefined,
							syncStatus: user.affiliateProfile.syncStatus,
							joinedAt:
								user.affiliateProfile.createdAt.toISOString(),
						}
					: undefined,
				recentSessions: user.sessions.map((session) => ({
					createdAt: session.createdAt.toISOString(),
					ipAddress: session.ipAddress || undefined,
					userAgent: session.userAgent || undefined,
				})),
				connectedAccounts: user.accounts.map((account) => ({
					providerId: account.providerId,
					createdAt: account.createdAt.toISOString(),
				})),
				stripeSubscriptionId:
					activePurchase?.subscriptionId || undefined,
				stripeCustomerId: activePurchase?.customerId || undefined,
				subscriptionDetails: activePurchase
					? {
							customerId: activePurchase.customerId,
							subscriptionId: activePurchase.subscriptionId,
							productId: activePurchase.productId,
							status: activePurchase.status,
							amount: activePurchase.cachedAmount ?? undefined,
							billingInterval:
								activePurchase.cachedInterval ?? undefined,
							currentPeriodEnd:
								activePurchase.currentPeriodEnd?.toISOString(),
							cancelAtPeriodEnd: activePurchase.cancelAtPeriodEnd,
							trialEnd: activePurchase.trialEnd?.toISOString(),
							cancelledAt:
								activePurchase.cancelledAt?.toISOString(),
							createdAt: activePurchase.createdAt.toISOString(),
						}
					: null,
				// Full purchase history (all records, not just active)
				purchaseHistory: user.purchases.map((p) => ({
					id: p.id,
					type: p.type,
					status: p.status || "unknown",
					planLabel: getPlanLabel(p),
					customerId: p.customerId,
					subscriptionId: p.subscriptionId || undefined,
					productId: p.productId,
					cachedAmount: p.cachedAmount || undefined,
					cachedInterval: p.cachedInterval || undefined,
					cachedCouponName: p.cachedCouponName || undefined,
					cachedDiscountPercent: p.cachedDiscountPercent || undefined,
					referralCode: p.referralCode || undefined,
					currentPeriodEnd:
						p.currentPeriodEnd?.toISOString() || undefined,
					cancelAtPeriodEnd: p.cancelAtPeriodEnd,
					cancelledAt: p.cancelledAt?.toISOString() || undefined,
					trialEnd: p.trialEnd?.toISOString() || undefined,
					createdAt: p.createdAt.toISOString(),
					updatedAt: p.updatedAt.toISOString(),
				})),
			};
		});

		// Apply post-query filters (subscriptionStatus, discordConnected)
		let filteredUsers = enrichedUsers;
		if (subscriptionStatus) {
			// Map "active" filter to include "lifetime" users who also have access
			filteredUsers = filteredUsers.filter(
				(u) =>
					u.subscriptionStatus === subscriptionStatus ||
					(subscriptionStatus === "active" &&
						u.subscriptionStatus === "lifetime"),
			);
		}
		if (discordConnected !== undefined) {
			filteredUsers = filteredUsers.filter(
				(u) => u.discordConnected === discordConnected,
			);
		}

		// Calculate stats from all active users (not just filtered, exclude soft-deleted)
		const activeUserFilter = { deletedAt: null };
		const totalUsers = await db.user.count({ where: activeUserFilter });
		const allUsersForStats = await db.user.findMany({
			where: activeUserFilter,
			include: {
				purchases: true,
				accounts: {
					where: { providerId: "discord" },
					select: { id: true },
				},
			},
		});

		const statsUsers = allUsersForStats.map((user) => {
			const activePurchases = user.purchases.filter(
				(p) => p.status === "active",
			);
			const hasManualAccess = activePurchases.some(
				(p) => p.productId === MANUAL_OVERRIDE_PRODUCT_ID,
			);
			const hasLifetime = activePurchases.some(
				(p) =>
					p.type === "ONE_TIME" &&
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID,
			);
			const hasStripeSub = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION",
			);
			const hasTrial = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.trialEnd &&
					new Date(p.trialEnd) > new Date(),
			);
			const hasPaymentGracePeriod = user.purchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.status === "grace_period",
			);
			// Stripe maps both cancel_at_period_end and flexible-billing cancel_at
			// onto Purchase.cancelAtPeriodEnd (see handleSubscriptionCancelAtPeriodEndSet).
			const hasScheduledCancel = activePurchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.cancelAtPeriodEnd === true &&
					p.currentPeriodEnd &&
					new Date(p.currentPeriodEnd) > new Date(),
			);
			const hasCancelledSub = user.purchases.some(
				(p) =>
					p.productId !== MANUAL_OVERRIDE_PRODUCT_ID &&
					p.type === "SUBSCRIPTION" &&
					p.status === "cancelled",
			);

			let subscriptionStatus:
				| "active"
				| "cancelled"
				| "grace_period"
				| "scheduled_cancel"
				| "none"
				| "manual"
				| "trial"
				| "lifetime";
			if (hasManualAccess) {
				subscriptionStatus = "manual";
			} else if (hasLifetime) {
				subscriptionStatus = "lifetime";
			} else if (hasTrial) {
				subscriptionStatus = "trial";
			} else if (hasPaymentGracePeriod) {
				subscriptionStatus = "grace_period";
			} else if (hasScheduledCancel) {
				subscriptionStatus = "scheduled_cancel";
			} else if (hasCancelledSub) {
				subscriptionStatus = "cancelled";
			} else if (hasStripeSub) {
				subscriptionStatus = "active";
			} else {
				subscriptionStatus = "none";
			}

			return {
				subscriptionStatus,
				discordConnected: user.discordConnected,
			};
		});

		const stats = {
			totalUsers,
			activeSubscriptions: statsUsers.filter(
				(u) =>
					u.subscriptionStatus === "active" ||
					u.subscriptionStatus === "trial" ||
					u.subscriptionStatus === "lifetime" ||
					u.subscriptionStatus === "scheduled_cancel" ||
					u.subscriptionStatus === "grace_period",
			).length,
			manualAccess: statsUsers.filter(
				(u) => u.subscriptionStatus === "manual",
			).length,
			discordConnected: statsUsers.filter((u) => u.discordConnected)
				.length,
		};

		return {
			users: filteredUsers,
			total: filteredUsers.length,
			stats,
		};
	});
