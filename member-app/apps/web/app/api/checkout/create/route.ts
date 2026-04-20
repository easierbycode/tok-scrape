import { type Config, config } from "@repo/config";
import { logger } from "@repo/logs";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
	if (!_stripe) {
		const key = process.env.STRIPE_SECRET_KEY;
		if (!key) {
			throw new Error("STRIPE_SECRET_KEY is not set");
		}
		_stripe = new Stripe(key, { apiVersion: "2025-10-29.clover" });
	}
	return _stripe;
}

function getAllowedPriceIds(): Set<string> {
	const plans = config.payments.plans as Config["payments"]["plans"];
	const ids = new Set<string>();
	for (const plan of Object.values(plans)) {
		if ("prices" in plan && plan.prices) {
			for (const price of plan.prices) {
				if (price.productId) {
					ids.add(price.productId);
				}
			}
		}
	}
	return ids;
}

export async function POST(request: NextRequest) {
	try {
		const { plan, priceId, referral, affiliateToken, allowPromoCodes } =
			await request.json();

		if (!priceId || typeof priceId !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid priceId" },
				{ status: 400 },
			);
		}

		const allowedPriceIds = getAllowedPriceIds();
		if (!allowedPriceIds.has(priceId)) {
			logger.warn("Checkout attempted with disallowed priceId", {
				priceId,
			});
			return NextResponse.json(
				{ error: "Invalid price" },
				{ status: 400 },
			);
		}

		const baseUrl =
			process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

		const stripe = getStripe();
		const price = await stripe.prices.retrieve(priceId);
		const mode = price.type === "recurring" ? "subscription" : "payment";

		const referralId =
			typeof referral === "string" && referral.trim().length > 0
				? referral.trim()
				: undefined;

		const affiliateTokenTrimmed =
			typeof affiliateToken === "string" &&
			affiliateToken.trim().length > 0
				? affiliateToken.trim()
				: undefined;

		const session = await stripe.checkout.sessions.create({
			mode,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: `${baseUrl}/auth/post-checkout-login?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${baseUrl}/#pricing`,
			allow_promotion_codes: allowPromoCodes === true,
			billing_address_collection: "auto",
			metadata: {
				plan,
				...(affiliateTokenTrimmed
					? { affiliate_token: affiliateTokenTrimmed }
					: {}),
			},
			...(referralId ? { client_reference_id: referralId } : {}),
			...(mode === "payment" ? { customer_creation: "always" } : {}),
		});

		return NextResponse.json({ checkoutUrl: session.url });
	} catch (error) {
		logger.error("Checkout creation error", { error });
		return NextResponse.json(
			{ error: "Failed to create checkout session" },
			{ status: 500 },
		);
	}
}
