import {
	fetchRewardfulAffiliateDetails,
	fetchRewardfulAffiliates,
	fetchRewardfulCommissions,
	fetchRewardfulReferrals,
} from "../packages/api/lib/rewardful-client";

async function testComplete() {
	console.log("🔍 Testing Complete Rewardful API Integration\n");

	try {
		// Test 1: List all affiliates
		console.log("=== TEST 1: Fetch All Affiliates ===");
		const affiliates = await fetchRewardfulAffiliates();
		console.log(`✅ Fetched ${affiliates.length} total affiliates\n`);

		// Test 2: Get details for first affiliate (fallback to any if none have conversions)
		let affiliateToTest = affiliates.find((a) => a.conversions > 0);

		if (!affiliateToTest) {
			console.log(
				"⚠️  No affiliates with conversions found, using first active affiliate",
			);
			affiliateToTest = affiliates.find((a) => a.state === "active");
		}

		if (!affiliateToTest) {
			console.log("❌ No affiliates available for testing");
			return;
		}

		console.log(
			`=== TEST 2: Affiliate Details (${affiliateToTest.email}) ===`,
		);

		const details = await fetchRewardfulAffiliateDetails(
			affiliateToTest.id,
		);

		if (!details) {
			console.error("❌ Details API returned undefined/null");
			throw new Error("Details API call failed");
		}

		console.log(`Links: ${details.links?.length || 0}`);
		if (details.links && details.links.length > 0) {
			const primaryLink = details.links[0];
			console.log(`Primary Link: ${primaryLink.url}`);
			console.log(`Token: ${primaryLink.token}`);
			console.log(
				`Link Stats: ${primaryLink.visitors} visitors, ${primaryLink.leads} leads, ${primaryLink.conversions} conversions`,
			);
		}
		console.log();

		// Test 3: Get commissions
		console.log("=== TEST 3: Commissions ===");
		const commissions = await fetchRewardfulCommissions(affiliateToTest.id);
		console.log(`Total commissions: ${commissions.length}`);

		const totalEarnings =
			commissions.reduce((sum, c) => sum + c.amount, 0) / 100;
		const pending = commissions.filter((c) => c.state === "pending").length;
		const paid = commissions.filter((c) => c.state === "paid").length;

		console.log(`Total Earnings: $${totalEarnings.toFixed(2)}`);
		console.log(`Pending: ${pending}, Paid: ${paid}`);
		console.log();

		// Test 4: Get referrals
		console.log("=== TEST 4: Referrals ===");
		const referrals = await fetchRewardfulReferrals(affiliateToTest.id);
		console.log(`Total referrals: ${referrals.length}`);

		if (referrals.length > 0) {
			const visitors = referrals.filter(
				(r) => r.conversion_state === "visitor",
			).length;
			const leads = referrals.filter(
				(r) => r.conversion_state === "lead",
			).length;
			const conversions = referrals.filter(
				(r) => r.conversion_state === "conversion",
			).length;

			console.log(
				`Breakdown: ${visitors} visitors, ${leads} leads, ${conversions} conversions`,
			);

			// Show sample referral with customer info if available
			const referralWithCustomer = referrals.find(
				(r) => r.customer !== null,
			);
			if (referralWithCustomer) {
				console.log("\nSample referral with customer:", {
					state: referralWithCustomer.conversion_state,
					customer: referralWithCustomer.customer,
					visits: referralWithCustomer.visits,
					created: referralWithCustomer.created_at,
				});
			} else {
				console.log("\nSample referral:", {
					state: referrals[0].conversion_state,
					visits: referrals[0].visits,
					link: referrals[0].link.url,
					created: referrals[0].created_at,
				});
			}
		}

		console.log("\n✅ All tests passed!");
	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

testComplete();
