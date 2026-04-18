import { db } from "../prisma/client";
import type { PrismaClient } from "../prisma/generated/client";

/**
 * Transaction helper for atomic database operations
 *
 * Usage:
 * ```ts
 * await withTransaction(async (tx) => {
 *   await tx.purchase.create({ ... });
 *   await tx.auditLog.create({ ... });
 *   // If either fails, both rollback
 * });
 * ```
 */
export type PrismaTransactionClient = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function withTransaction<T>(
	fn: (tx: PrismaTransactionClient) => Promise<T>,
	timeout = 5000,
): Promise<T> {
	return await db.$transaction(fn, {
		maxWait: 2000, // Max wait to start transaction
		timeout, // Max duration of transaction
	});
}
