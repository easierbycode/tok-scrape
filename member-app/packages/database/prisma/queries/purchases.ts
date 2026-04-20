import type { z } from "zod";
import { db } from "../client";
import type { PurchaseSchema } from "../zod";

export async function getPurchaseById(id: string) {
	return db.purchase.findUnique({
		where: { id },
	});
}

export async function getPurchasesByOrganizationId(organizationId: string) {
	return db.purchase.findMany({
		where: {
			organizationId,
		},
	});
}

export async function getPurchasesByUserId(userId: string) {
	return db.purchase.findMany({
		where: {
			userId,
		},
	});
}

export async function getPurchaseBySubscriptionId(subscriptionId: string) {
	return db.purchase.findFirst({
		where: {
			subscriptionId,
		},
	});
}

export async function createPurchase(
	purchase: Omit<
		z.infer<typeof PurchaseSchema>,
		| "id"
		| "createdAt"
		| "updatedAt"
		| "cancelAtPeriodEnd"
		| "currentPeriodEnd"
		| "cancelledAt"
		| "trialEnd"
		| "referralCode"
		| "rewardfulReferralId"
	> & {
		cancelAtPeriodEnd?: boolean;
		currentPeriodEnd?: Date | null;
		cancelledAt?: Date | null;
		trialEnd?: Date | null;
		referralCode?: string | null;
		rewardfulReferralId?: string | null;
	},
) {
	if (!purchase.userId) {
		throw new Error(
			"createPurchase requires a userId — purchases must always be linked to a user",
		);
	}

	const created = await db.purchase.create({
		data: {
			...purchase,
			cancelAtPeriodEnd: purchase.cancelAtPeriodEnd ?? false,
		},
	});

	return getPurchaseById(created.id);
}

export async function updatePurchase(
	purchase: Partial<
		Omit<z.infer<typeof PurchaseSchema>, "createdAt" | "updatedAt">
	> & { id: string },
) {
	const updated = await db.purchase.update({
		where: {
			id: purchase.id,
		},
		data: purchase,
	});

	return getPurchaseById(updated.id);
}

export async function updatePurchaseSchedule(
	id: string,
	data: {
		scheduleId?: string | null;
		pendingPriceId?: string | null;
		pendingPlanName?: string | null;
		pendingPlanChangeAt?: Date | null;
	},
) {
	return db.purchase.update({
		where: { id },
		data,
	});
}

export async function deletePurchaseBySubscriptionId(subscriptionId: string) {
	await db.purchase.update({
		where: {
			subscriptionId,
		},
		data: {
			status: "canceled",
			cancelledAt: new Date(),
		},
	});
}
