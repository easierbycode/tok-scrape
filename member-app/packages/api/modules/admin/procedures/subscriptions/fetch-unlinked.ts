import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { getStripeClient } from "@repo/payments";
import { adminProcedure } from "../../../../orpc/procedures";

function formatIntervalLabel(interval: string): string {
	if (interval === "month") {
		return "monthly";
	}
	if (interval === "year") {
		return "yearly";
	}
	if (interval === "week") {
		return "weekly";
	}
	if (interval === "day") {
		return "daily";
	}
	return interval;
}

export const fetchUnlinked = adminProcedure
	.route({
		method: "GET",
		path: "/admin/subscriptions/fetch-unlinked",
		tags: ["Administration"],
		summary:
			"List active Stripe subscriptions without a linked app purchase",
	})
	.handler(async () => {
		const stripe = getStripeClient();

		// Fetch all active subscriptions from Stripe (cast to any for SDK v19 compat)
		const allSubs: Record<string, unknown>[] = [];
		let startingAfter: string | undefined;

		while (true) {
			const page: any = await stripe.subscriptions.list({
				status: "active",
				limit: 100,
				...(startingAfter ? { starting_after: startingAfter } : {}),
			});

			const data = (page.data ?? []) as Record<string, unknown>[];
			allSubs.push(...data);

			if (!page.has_more) {
				break;
			}
			const last = data[data.length - 1];
			startingAfter = last?.id as string | undefined;
			if (!startingAfter) {
				break;
			}
		}

		logger.info("fetch-unlinked: Stripe returned subscriptions", {
			count: allSubs.length,
		});

		if (allSubs.length === 0) {
			return {
				unlinked: [],
				debug: { stripeTotal: 0, linkedCount: 0, noEmailCount: 0 },
			};
		}

		const subscriptionIds = allSubs.map((s) => s.id as string);
		const existingPurchases = await db.purchase.findMany({
			where: { subscriptionId: { in: subscriptionIds } },
			select: { subscriptionId: true },
		});
		const linkedIds = new Set(
			existingPurchases
				.map((p) => p.subscriptionId)
				.filter((id): id is string => Boolean(id)),
		);

		const unlinkedSubs = allSubs.filter(
			(s) => !linkedIds.has(s.id as string),
		);

		logger.info("fetch-unlinked: filtering results", {
			stripeTotal: allSubs.length,
			linkedCount: linkedIds.size,
			unlinkedCount: unlinkedSubs.length,
		});

		// Collect unique customer IDs
		const customerIds = [
			...new Set(
				unlinkedSubs.map((s) => {
					const cust = s.customer;
					return typeof cust === "string"
						? cust
						: ((cust as Record<string, unknown>)?.id as string);
				}),
			),
		].filter(Boolean);

		// Batch-fetch customer objects for email/name
		const customerById = new Map<
			string,
			{ email?: string; name?: string }
		>();
		for (let i = 0; i < customerIds.length; i += 20) {
			const batch = customerIds.slice(i, i + 20);
			await Promise.all(
				batch.map(async (customerId) => {
					try {
						const c: any =
							await stripe.customers.retrieve(customerId);
						if (c.deleted) {
							return;
						}
						customerById.set(customerId, {
							email: c.email ?? undefined,
							name: c.name ?? undefined,
						});
					} catch (error) {
						logger.warn("Failed to retrieve Stripe customer", {
							customerId,
							error:
								error instanceof Error
									? error.message
									: String(error),
						});
					}
				}),
			);
		}

		// Collect unique product IDs from subscription items and batch-fetch names
		const productIds = new Set<string>();
		for (const sub of unlinkedSubs) {
			const items = sub.items as any;
			const price = items?.data?.[0]?.price ?? items?.data?.[0]?.plan;
			const prodId = price?.product;
			if (typeof prodId === "string") {
				productIds.add(prodId);
			}
		}

		const productNameById = new Map<string, string>();
		const prodIdArray = [...productIds];
		for (let i = 0; i < prodIdArray.length; i += 20) {
			const batch = prodIdArray.slice(i, i + 20);
			await Promise.all(
				batch.map(async (prodId) => {
					try {
						const product: any =
							await stripe.products.retrieve(prodId);
						if (product.name) {
							productNameById.set(prodId, product.name);
						}
					} catch {
						// ignore -- will fall back to "Subscription"
					}
				}),
			);
		}

		const unlinked: {
			subscriptionId: string;
			customerId: string;
			customerEmail: string;
			customerName?: string;
			plan: string;
			amount: number;
			currentPeriodEnd: string | null;
		}[] = [];

		for (const sub of unlinkedSubs) {
			const cust = sub.customer;
			const customerId =
				typeof cust === "string"
					? cust
					: ((cust as Record<string, unknown>)?.id as string);
			const customer = customerById.get(customerId);
			const email = customer?.email?.trim();
			if (!email) {
				continue;
			}

			const items = sub.items as any;
			const firstItem = items?.data?.[0];
			const price = firstItem?.price ?? firstItem?.plan;

			const prodId =
				typeof price?.product === "string" ? price.product : null;
			const productName =
				(prodId && productNameById.get(prodId)) || "Subscription";
			const interval: string =
				price?.recurring?.interval ?? price?.interval ?? "month";
			const amount: number = price?.unit_amount ?? price?.amount ?? 0;
			const plan = `${productName} (${formatIntervalLabel(interval)})`;

			const periodEndUnix =
				(sub as any).current_period_end ??
				(sub as any).currentPeriodEnd;

			unlinked.push({
				subscriptionId: sub.id as string,
				customerId,
				customerEmail: email,
				customerName: customer?.name ?? undefined,
				plan,
				amount,
				currentPeriodEnd: periodEndUnix
					? new Date(
							(typeof periodEndUnix === "number"
								? periodEndUnix * 1000
								: Number(periodEndUnix)) || 0,
						).toISOString()
					: null,
			});
		}

		const noEmailCount = unlinkedSubs.length - unlinked.length;

		logger.info("fetch-unlinked: final results", {
			unlinkedWithEmail: unlinked.length,
			skippedNoEmail: noEmailCount,
		});

		return {
			unlinked,
			debug: {
				stripeTotal: allSubs.length,
				linkedCount: linkedIds.size,
				noEmailCount,
			},
		};
	});
