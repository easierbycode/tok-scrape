import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2025-10-29.clover",
});

function maskEmail(email: string): string {
	const [local, domain] = email.split("@");
	if (!local || !domain) {
		return "***@***";
	}
	const maskedLocal =
		local.length <= 2
			? `${local[0]}***`
			: `${local[0]}***${local[local.length - 1]}`;
	const domainParts = domain.split(".");
	const maskedDomain =
		domainParts[0].length <= 2
			? `${domainParts[0][0]}***`
			: domainParts[0][0] +
				"***" +
				domainParts[0][domainParts[0].length - 1];
	return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

export async function POST(request: NextRequest) {
	try {
		const { sessionId } = await request.json();
		if (process.env.NODE_ENV === "development") {
			logger.debug("validate-checkout called", {
				sessionId: `${sessionId?.substring(0, 20)}...`,
			});
		}

		if (!sessionId || typeof sessionId !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid sessionId" },
				{ status: 400 },
			);
		}

		const session = await stripe.checkout.sessions.retrieve(sessionId);
		if (process.env.NODE_ENV === "development") {
			logger.debug("Stripe session retrieved", {
				customer: session.customer,
				mode: session.mode,
				paymentStatus: session.payment_status,
			});
		}

		if (!session.customer) {
			logger.error("No customer in Stripe session");
			return NextResponse.json(
				{ error: "Invalid session - no customer" },
				{ status: 400 },
			);
		}

		const customer = await stripe.customers.retrieve(
			session.customer as string,
		);
		const email = (customer as Stripe.Customer).email;
		if (process.env.NODE_ENV === "development") {
			logger.debug("Customer email from Stripe", { email });
		}

		if (!email) {
			logger.error("No email found for customer");
			return NextResponse.json(
				{ error: "No email found" },
				{ status: 400 },
			);
		}

		const user = await db.user.findUnique({ where: { email } });
		if (process.env.NODE_ENV === "development") {
			logger.debug("User lookup", {
				found: !!user,
			});
		}

		if (!user) {
			if (process.env.NODE_ENV === "development") {
				logger.debug(
					"User not found - webhook may still be processing",
				);
			}
			return NextResponse.json(
				{
					error: "User not found - webhook may still be processing",
					ready: false,
				},
				{ status: 202 },
			);
		}

		logger.info("User found via checkout validation", {
			userId: user.id,
		});
		return NextResponse.json({
			success: true,
			email,
			maskedEmail: maskEmail(email),
		});
	} catch (error) {
		logger.error("Validate checkout error", { error });
		return NextResponse.json(
			{ error: "Validation failed" },
			{ status: 500 },
		);
	}
}
