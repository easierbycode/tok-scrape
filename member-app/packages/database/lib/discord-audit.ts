import { db } from "../prisma/client";

export async function createDiscordAuditLog({
	userId,
	discordId,
	discordUsername,
	action,
	reason,
	performedBy,
	metadata,
}: {
	userId: string;
	discordId: string;
	discordUsername?: string | null;
	action: "connected" | "disconnected" | "kicked" | "role_changed";
	reason?: string;
	performedBy?: string;
	metadata?: Record<string, any>;
}) {
	return await db.discordAudit.create({
		data: {
			userId,
			discordId,
			discordUsername,
			action,
			reason,
			performedBy,
			metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
		},
	});
}

export async function getDiscordAuditLogs(userId: string) {
	return await db.discordAudit.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
}

