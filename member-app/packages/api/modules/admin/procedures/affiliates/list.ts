import { db } from "@repo/database";
import { z } from "zod";
import { mapRewardfulToAffiliateWithMetrics } from "../../../../lib/affiliate-mapper";
import { getCachedRewardfulAffiliates } from "../../../../lib/rewardful-cache";
import { adminProcedure } from "../../../../orpc/procedures";
import type { AffiliateStats } from "../../types";

export const list = adminProcedure
	.route({
		method: "GET",
		path: "/admin/affiliates/list",
		tags: ["Administration"],
		summary: "Get affiliates list with filtering and stats",
	})
	.input(
		z.object({
			status: z
				.enum(["active", "disabled", "suspicious", "all"])
				.optional(),
			searchTerm: z.string().optional(),
			quickFilter: z
				.enum(["all", "needs-attention", "new", "no-account"])
				.optional(),
			page: z.number().optional(),
			limit: z.number().optional(),
		}),
	)
	.handler(async ({ input }) => {
		// Fetch affiliates from Rewardful (cached)
		const { affiliates: rewardfulAffiliates } =
			await getCachedRewardfulAffiliates(false);

		// Get all affiliates from database for additional context
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

		// Create a map of rewardfulId -> dbAffiliate for quick lookup
		const dbMap = new Map(dbAffiliates.map((a) => [a.rewardfulId, a]));

		// Map Rewardful affiliates to frontend format
		let affiliates = rewardfulAffiliates.map((rAffiliate) => {
			const dbAffiliate = dbMap.get(rAffiliate.id);
			return mapRewardfulToAffiliateWithMetrics(rAffiliate, dbAffiliate);
		});

		// noAccountCount is always global — needed for the No Account tab badge
		const noAccountCount = affiliates.filter(
			(a) => !a.hasUserAccount,
		).length;

		// Apply status filter
		if (input.status && input.status !== "all") {
			affiliates = affiliates.filter((a) => a.status === input.status);
		}

		// Apply search filter
		if (input.searchTerm) {
			const query = input.searchTerm.toLowerCase();
			affiliates = affiliates.filter(
				(a) =>
					a.name.toLowerCase().includes(query) ||
					a.email.toLowerCase().includes(query) ||
					a.rewardfulId.toLowerCase().includes(query),
			);
		}

		// Apply quick filter (server-side, works across all affiliates)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		switch (input.quickFilter) {
			case "needs-attention":
				affiliates = affiliates
					.filter((a) => a.totalClicks >= 10 && a.conversions === 0)
					.sort((a, b) => b.totalClicks - a.totalClicks);
				break;
			case "new":
				affiliates = affiliates
					.filter((a) => new Date(a.joinDate) > thirtyDaysAgo)
					.sort(
						(a, b) =>
							new Date(b.joinDate).getTime() -
							new Date(a.joinDate).getTime(),
					);
				break;
			case "no-account":
				affiliates = affiliates
					.filter((a) => !a.hasUserAccount)
					.sort(
						(a, b) => b.totalEarnings - a.totalEarnings,
					);
				break;
			default:
				// "all" — sort by earnings descending
				affiliates.sort(
					(a, b) => b.totalEarnings - a.totalEarnings,
				);
				break;
		}

		// Calculate stats from the filtered set so cards reflect the active tab
		const totalAffiliates = affiliates.length;
		const activeAffiliates = affiliates.filter(
			(a) => a.status === "active",
		).length;
		const totalClicks = affiliates.reduce(
			(sum, a) => sum + a.totalClicks,
			0,
		);
		const totalConversions = affiliates.reduce(
			(sum, a) => sum + a.conversions,
			0,
		);
		const totalCommissions = {
			pending: affiliates.reduce((sum, a) => sum + a.pendingEarnings, 0),
			due: affiliates.reduce((sum, a) => sum + a.dueEarnings, 0),
			paid: affiliates.reduce((sum, a) => sum + a.paidEarnings, 0),
			total: affiliates.reduce((sum, a) => sum + a.totalEarnings, 0),
		};
		const grossRevenue = affiliates.reduce(
			(sum, a) => sum + a.grossRevenue,
			0,
		);

		const stats: AffiliateStats = {
			totalAffiliates,
			activeAffiliates,
			noAccountCount,
			totalClicks,
			totalConversions,
			totalCommissions,
			grossRevenue,
		};

		// Apply pagination if specified
		const page = input.page || 1;
		const limit = input.limit || 50;
		const start = (page - 1) * limit;
		const end = start + limit;
		const paginatedAffiliates = affiliates.slice(start, end);

		return {
			stats,
			affiliates: paginatedAffiliates,
			total: affiliates.length,
			page,
			limit,
			lastSync:
				dbAffiliates.length > 0
					? dbAffiliates
							.map((a) => a.lastSyncAt)
							.filter((date): date is Date => date !== null)
							.sort((a, b) => b.getTime() - a.getTime())[0]
							?.toISOString() || null
					: null,
			syncStatus: {
				synced: dbAffiliates.filter((a) => a.syncStatus === "synced")
					.length,
				errors: dbAffiliates.filter((a) => a.syncStatus === "error")
					.length,
				neverSynced: dbAffiliates.filter(
					(a) => a.syncStatus === "never_synced",
				).length,
			},
		};
	});
