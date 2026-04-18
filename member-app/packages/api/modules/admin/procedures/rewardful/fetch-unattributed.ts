import { ORPCError } from "@orpc/client";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import {
	fetchAllConversionReferrals,
	type RewardfulReferral,
} from "../../../../lib/rewardful-client";
import { adminProcedure } from "../../../../orpc/procedures";

export interface UnattributedReferralRow {
	userId: string;
	userName: string;
	stripeEmail: string;
	referralId: string;
	affiliateToken: string;
	affiliateName: string;
	affiliateEmail: string;
}

const FetchUnattributedInput = z.object({
	days: z
		.number()
		.int()
		.min(1)
		.max(365)
		.optional()
		.describe(
			"Only scan referrals updated within the last N days. Omit for all time.",
		),
});

export const fetchUnattributed = adminProcedure
	.route({
		method: "GET",
		path: "/admin/rewardful/fetch-unattributed",
		tags: ["Administration"],
		summary:
			"List app users matched to Rewardful conversions who lack referral attribution",
	})
	.input(FetchUnattributedInput)
	.handler(async ({ input }) => {
		const { days } = input;

		let updatedSince: string | undefined;
		if (days) {
			const since = new Date();
			since.setDate(since.getDate() - days);
			updatedSince = since.toISOString();
		}

		let referrals: RewardfulReferral[];
		try {
			referrals = await fetchAllConversionReferrals(updatedSince);
		} catch (error) {
			logger.error("Failed to fetch Rewardful conversion referrals", {
				error: error instanceof Error ? error.message : error,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message:
					error instanceof Error
						? error.message
						: "Rewardful API error",
			});
		}

		const usersNeedingAttribution = await db.user.findMany({
			where: {
				referredBySlug: null,
				stripeEmail: { not: null },
			},
			select: {
				id: true,
				name: true,
				stripeEmail: true,
			},
		});

		const emailToUser = new Map<
			string,
			{ id: string; name: string | null; stripeEmail: string | null }
		>();
		for (const u of usersNeedingAttribution) {
			if (u.stripeEmail) {
				emailToUser.set(u.stripeEmail.trim().toLowerCase(), u);
			}
		}

		const sorted = [...referrals].sort(
			(a, b) =>
				new Date(b.became_conversion_at ?? b.updated_at).getTime() -
				new Date(a.became_conversion_at ?? a.updated_at).getTime(),
		);

		const seenUserIds = new Set<string>();
		const rows: UnattributedReferralRow[] = [];

		for (const ref of sorted) {
			const email = ref.customer?.email?.trim().toLowerCase();
			if (!email) {
				continue;
			}

			const user = emailToUser.get(email);
			if (!user || seenUserIds.has(user.id)) {
				continue;
			}

			const affiliateToken = ref.link?.token?.trim();
			if (!affiliateToken) {
				continue;
			}

			seenUserIds.add(user.id);

			const aff = ref.affiliate;
			const affiliateName = aff
				? [aff.first_name, aff.last_name]
						.filter(Boolean)
						.join(" ")
						.trim() || "—"
				: "—";

			rows.push({
				userId: user.id,
				userName: user.name ?? "—",
				stripeEmail: user.stripeEmail ?? email,
				referralId: ref.id,
				affiliateToken,
				affiliateName,
				affiliateEmail: aff?.email ?? "—",
			});
		}

		return { rows, totalReferralsScanned: referrals.length };
	});
