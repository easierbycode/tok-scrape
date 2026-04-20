import { getStripeClient } from "@repo/payments";
import { adminProcedure } from "../../../../orpc/procedures";

export const listCoupons = adminProcedure
	.route({
		method: "GET",
		path: "/admin/subscriptions/list-coupons",
		tags: ["Administration"],
		summary: "Get available Stripe coupons",
	})
	.handler(async () => {
		const stripe = getStripeClient();

		// Fetch all coupons from Stripe
		const coupons = await stripe.coupons.list({
			limit: 100,
		});

		// Transform and filter to only valid, active coupons
		const activeCoupons = coupons.data
			.filter((coupon) => coupon.valid)
			.map((coupon) => {
				// Build human-readable discount description
				let discount = "";
				if (coupon.percent_off) {
					discount = `${coupon.percent_off}% off`;
				} else if (coupon.amount_off) {
					discount = `$${coupon.amount_off / 100} off`;
				}

				// Add duration info
				if (coupon.duration === "once") {
					discount += " (one time)";
				} else if (coupon.duration === "repeating" && coupon.duration_in_months) {
					discount += ` for ${coupon.duration_in_months} months`;
				} else if (coupon.duration === "forever") {
					discount += " (forever)";
				}

				return {
					id: coupon.id,
					name: coupon.name || coupon.id,
					discount,
					percentOff: coupon.percent_off,
					amountOff: coupon.amount_off,
					duration: coupon.duration,
					durationInMonths: coupon.duration_in_months,
					valid: coupon.valid,
				};
			});

		return { coupons: activeCoupons };
	});
