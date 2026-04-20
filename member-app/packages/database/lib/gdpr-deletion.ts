import { logger } from "@repo/logs";
import { db } from "../prisma/client";
import { logAdminAction } from "./audit-logger";

interface DeletionOptions {
	userId: string;
	deletedBy: string;
	reason: "user_request" | "admin_action" | "gdpr";
	immediate?: boolean;
}

export async function requestUserDeletion({
	userId,
	deletedBy,
	reason,
	immediate = false,
}: DeletionOptions) {
	const user = await db.user.findUnique({
		where: { id: userId },
		include: {
			purchases: {
				where: {
					type: "SUBSCRIPTION",
					status: { in: ["active", "trialing"] },
				},
			},
		},
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.purchases.length > 0 && !immediate) {
		throw new Error("Cannot delete user with active subscriptions");
	}

	const now = new Date();
	const gdprGracePeriod = 30; // days
	const financialRetentionYears = 7; // EU requirement

	const scheduledPurgeAt = new Date(now);
	scheduledPurgeAt.setDate(scheduledPurgeAt.getDate() + gdprGracePeriod);

	const dataRetentionUntil = new Date(now);
	dataRetentionUntil.setFullYear(
		dataRetentionUntil.getFullYear() + financialRetentionYears,
	);

	// Soft delete (PII anonymization is deferred to purge cron for restore capability)
	const updateData: Record<string, unknown> = {
		deletedAt: now,
		deletedBy,
		deletionReason: reason,
		scheduledPurgeAt: immediate ? now : scheduledPurgeAt,
		dataRetentionUntil,
	};

	// Only anonymize PII immediately if explicitly requested (immediate deletion)
	if (immediate) {
		Object.assign(updateData, {
			name: "Deleted User",
			email: `deleted_${userId}@deleted.local`,
			image: null,
			username: null,
			displayUsername: null,
			locale: null,
			notificationEmail: null,
			stripeEmail: null,
			discordId: null,
			discordUsername: null,
			discordConnected: false,
		});
	}

	await db.user.update({
		where: { id: userId },
		data: updateData,
	});

	if (immediate) {
		await db.account.deleteMany({ where: { userId } });
	}

	// Update purchases with retention date
	await db.purchase.updateMany({
		where: { userId },
		data: {
			deletedAt: now,
			financialRetentionUntil: dataRetentionUntil,
		},
	});

	await logAdminAction({
		adminUserId: deletedBy,
		action: "DELETE_USER",
		targetType: "user",
		targetId: userId,
		summary: immediate
			? `Scheduled immediate deletion for ${user.email}`
			: `Scheduled deletion for ${user.email} (purge ${scheduledPurgeAt.toISOString().slice(0, 10)})`,
		metadata: {
			reason,
			immediate,
			scheduledPurgeAt: scheduledPurgeAt.toISOString(),
		},
	});

	return {
		success: true,
		scheduledPurgeAt,
		message: immediate
			? "User deleted immediately"
			: `User scheduled for deletion on ${scheduledPurgeAt.toISOString()}`,
	};
}

export async function restoreUser(userId: string, restoredBy: string) {
	const user = await db.user.findUnique({ where: { id: userId } });

	if (!user || !user.deletedAt) {
		throw new Error("User not found or not deleted");
	}

	// Check if PII was already anonymized (immediate deletion or already purged)
	if (user.email.includes("@deleted.local")) {
		throw new Error("User data was anonymized and cannot be restored");
	}

	// Restore user and associated purchase records
	await db.user.update({
		where: { id: userId },
		data: {
			deletedAt: null,
			deletedBy: null,
			deletionReason: null,
			scheduledPurgeAt: null,
			dataRetentionUntil: null,
		},
	});

	await db.purchase.updateMany({
		where: { userId },
		data: {
			deletedAt: null,
			financialRetentionUntil: null,
		},
	});

	await logAdminAction({
		adminUserId: restoredBy,
		action: "RESTORE_USER",
		targetType: "user",
		targetId: userId,
		summary: `Restored deleted user ${user.email}`,
		metadata: { previousDeletedAt: user.deletedAt?.toISOString() },
	});

	return { success: true };
}

export async function purgeScheduledDeletions() {
	const now = new Date();

	const usersToDelete = await db.user.findMany({
		where: {
			scheduledPurgeAt: { lte: now },
			deletedAt: { not: null },
		},
		include: { purchases: true },
	});

	let purged = 0;
	let anonymized = 0;

	for (const user of usersToDelete) {
		const hasRetainedPurchases = user.purchases.some(
			(p) => p.financialRetentionUntil && p.financialRetentionUntil > now,
		);

		if (hasRetainedPurchases) {
			// Can't hard-delete yet due to financial retention.
			// Anonymize PII if not already done.
			if (!user.email.includes("@deleted.local")) {
				await db.user.update({
					where: { id: user.id },
					data: {
						name: "Deleted User",
						email: `deleted_${user.id}@deleted.local`,
						image: null,
						username: null,
						displayUsername: null,
						locale: null,
						notificationEmail: null,
						stripeEmail: null,
						discordId: null,
						discordUsername: null,
						discordConnected: false,
					},
				});
				await db.account.deleteMany({ where: { userId: user.id } });
				anonymized++;
				logger.info("Anonymized user with retained financial records", {
					userId: user.id,
				});
			}
			continue;
		}

		// No retained purchases — hard delete
		await db.user.delete({ where: { id: user.id } });
		purged++;
	}

	return { purged, anonymized };
}

export async function exportUserData(userId: string) {
	const user = await db.user.findUnique({
		where: { id: userId },
		include: {
			purchases: true,
			sessions: { select: { createdAt: true, ipAddress: true } },
			notifications: true,
		},
	});

	if (!user) throw new Error("User not found");

	return {
		profile: {
			name: user.name,
			email: user.email,
			username: user.username,
			createdAt: user.createdAt,
		},
		purchases: user.purchases.map((p) => ({
			type: p.type,
			status: p.status,
			createdAt: p.createdAt,
		})),
		sessions: user.sessions,
		notifications: user.notifications,
	};
}
