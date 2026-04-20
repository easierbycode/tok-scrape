import { auth } from "@repo/auth";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { webhookHandler as paymentsWebhookHandler } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import Stripe from "stripe";
import { checkRateLimit } from "./lib/rate-limit";
import { handleExtendedWebhookLogic } from "./lib/webhook-extensions";
import { openApiHandler, rpcHandler } from "./orpc/handler";

// Simple rate limiter middleware for Hono
function createHonoRateLimiter(limit: number, windowMs: number) {
	return async (c: any, next: () => Promise<void>) => {
		const ip =
			c.req.header("x-forwarded-for") ||
			c.req.header("x-real-ip") ||
			"unknown";
		const result = checkRateLimit(ip, { limit, windowMs });

		if (!result.allowed) {
			const resetInSeconds = Math.ceil(
				(result.resetAt - Date.now()) / 1000,
			);
			return c.json(
				{
					error: "Too many requests",
					message: `Rate limit exceeded. Try again in ${resetInSeconds} seconds.`,
				},
				429,
			);
		}

		await next();
	};
}

export const app = new Hono()
	.basePath("/api")
	// Logger middleware
	.use(honoLogger((message, ...rest) => logger.log(message, ...rest)))
	// Rate limiting for auth endpoints
	.use("/auth/**", createHonoRateLimiter(20, 15 * 60 * 1000)) // 20 per 15 minutes
	// Rate limiting for admin endpoints
	.use("/admin/**", createHonoRateLimiter(100, 15 * 60 * 1000)) // 100 per 15 minutes
	// Cors middleware
	.use(
		cors({
			origin: (origin) => {
				const allowedOrigin = getBaseUrl();

				if (!allowedOrigin) {
					throw new Error(
						"BASE_URL not configured - cannot setup CORS",
					);
				}

				// Allow same-origin requests (no origin header)
				if (!origin) {
					return allowedOrigin;
				}

				// Allow configured origin
				if (origin === allowedOrigin) {
					return origin;
				}

				// Allow Vercel preview deployments for this project
				if (
					origin.endsWith(".vercel.app") &&
					process.env.VERCEL_PROJECT_PRODUCTION_URL
				) {
					const projectSlug =
						process.env.VERCEL_PROJECT_PRODUCTION_URL.split(".")[0];
					if (projectSlug && origin.includes(projectSlug)) {
						return origin;
					}
				}

				// Reject all others
				logger.warn("CORS rejected origin", {
					origin,
					allowed: allowedOrigin,
				});
				return null;
			},
			allowHeaders: ["Content-Type", "Authorization", "x-csrf-token"],
			allowMethods: ["POST", "GET", "OPTIONS"],
			exposeHeaders: ["Content-Length"],
			maxAge: 600,
			credentials: true,
		}),
	)
	// Auth handler
	.all("/auth/**", (c) => auth.handler(c.req.raw))
	// Payments webhook handler with extension logic
	.post("/webhooks/payments", async (c) => {
		const request = c.req.raw;

		// Read body once (before any handler consumes it)
		const body = await request.text();
		const signature = request.headers.get("stripe-signature");

		// Verify and parse Stripe event
		let stripeEvent: Stripe.Event | null = null;
		if (
			signature &&
			process.env.STRIPE_SECRET_KEY &&
			process.env.STRIPE_WEBHOOK_SECRET
		) {
			try {
				const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
				stripeEvent = stripe.webhooks.constructEvent(
					body,
					signature,
					process.env.STRIPE_WEBHOOK_SECRET,
				);
			} catch (error) {
				logger.error("Webhook signature verification failed", {
					error,
				});
				return c.json({ error: "Invalid signature" }, 400);
			}
		}

		if (!stripeEvent) {
			return c.json({ error: "No event" }, 400);
		}

		// Check if already processed
		const existingEvent = await db.webhookEvent.findUnique({
			where: { id: stripeEvent.id },
		});

		if (existingEvent?.processed) {
			logger.info("Webhook already processed, skipping", {
				eventId: stripeEvent.id,
				eventType: stripeEvent.type,
			});
			return c.json({ received: true, status: "already_processed" }, 200);
		}

		// Record that we're processing this webhook
		await db.webhookEvent.upsert({
			where: { id: stripeEvent.id },
			create: {
				id: stripeEvent.id,
				type: stripeEvent.type,
				processed: false,
			},
			update: {},
		});

		// Create new request with same body for core handler
		const coreRequest = new Request(request.url, {
			method: "POST",
			headers: request.headers,
			body,
		});

		// For subscription.deleted, extended logic MUST run before the core handler
		// because the core handler deletes the purchase record, which the extended
		// handler needs to look up for Discord kicks and notifications.
		if (stripeEvent.type === "customer.subscription.deleted") {
			await handleExtendedWebhookLogic(stripeEvent).catch((error) => {
				logger.error("Failed to process extended webhook logic", {
					eventId: stripeEvent?.id,
					error: error instanceof Error ? error.message : error,
				});
			});
		}

		// Let core Supastarter handler process the webhook (basic CRUD)
		const coreResponse = await paymentsWebhookHandler(coreRequest);

		// If core handler failed, return early
		if (!coreResponse.ok) {
			return coreResponse;
		}

		// Handle extended logic for all other event types (grace period, Discord, notifications)
		// Non-blocking - errors logged but don't fail webhook
		if (stripeEvent.type !== "customer.subscription.deleted") {
			await handleExtendedWebhookLogic(stripeEvent).catch((error) => {
				logger.error("Failed to process extended webhook logic", {
					eventId: stripeEvent?.id,
					error: error instanceof Error ? error.message : error,
				});
			});
		}

		// Mark as processed
		await db.webhookEvent.update({
			where: { id: stripeEvent.id },
			data: { processed: true },
		});

		return coreResponse;
	})
	// Health check
	.get("/health", (c) => c.text("OK"))
	// oRPC handlers (for RPC and OpenAPI)
	.use("*", async (c, next) => {
		const context = {
			headers: c.req.raw.headers,
			request: {
				method: c.req.method,
			},
		};

		const isRpc = c.req.path.includes("/rpc/");

		const handler = isRpc ? rpcHandler : openApiHandler;

		const prefix = isRpc ? "/api/rpc" : "/api";

		const { matched, response } = await handler.handle(c.req.raw, {
			prefix,
			context,
		});

		if (matched) {
			return c.newResponse(response.body, response);
		}

		await next();
	});
