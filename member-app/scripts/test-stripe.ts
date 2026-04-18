/**
 * Tests Stripe API connection
 * Run: pnpm tsx scripts/test-stripe.ts
 */

import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
	console.error("❌ STRIPE_SECRET_KEY not found in environment");
	process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
	apiVersion: "2024-11-20.acacia",
});

async function test() {
	try {
		// Test account retrieval
		const account = await stripe.accounts.retrieve();
		console.log("✅ Stripe connected:", account.email || account.id);

		// Test product listing
		const products = await stripe.products.list({ limit: 1 });
		console.log("✅ Can list products:", products.data.length);

		// Test price listing
		const prices = await stripe.prices.list({ limit: 1 });
		console.log("✅ Can list prices:", prices.data.length);

		console.log("\n✅ Stripe connection test passed!");
		process.exit(0);
	} catch (error) {
		console.error("❌ Stripe test failed:", error);
		process.exit(1);
	}
}

test();
