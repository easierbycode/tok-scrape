import { fetchRewardfulAffiliates } from "../packages/api/lib/rewardful-client";

async function test() {
	console.log("🔍 Testing Rewardful connection...\n");

	try {
		const affiliates = await fetchRewardfulAffiliates();

		console.log(
			`✅ Successfully fetched ${affiliates.length} affiliates\n`,
		);

		// Display first 3
		console.log("Sample affiliates:");
		affiliates.slice(0, 3).forEach((aff, i) => {
			console.log(
				`\n${i + 1}. ${aff.first_name} ${aff.last_name} (${aff.email})`,
			);
			console.log(`   ID: ${aff.id}`);
			console.log(`   State: ${aff.state}`);
			console.log(`   Visitors: ${aff.visitors}`);
			console.log(`   Leads: ${aff.leads}`);
			console.log(`   Conversions: ${aff.conversions}`);
		});
	} catch (error) {
		console.error("❌ Test failed:", error);
		process.exit(1);
	}
}

test();
