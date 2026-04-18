import { ORPCError } from "@orpc/server";
import { randomBytes } from "crypto";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const GetPendingInvitesInputSchema = z.object({
	status: z.enum(["pending", "joined", "expired"]).optional(),
});

const CancelInviteInputSchema = z.object({
	inviteId: z.string().min(1),
});

const ResendInviteInputSchema = z.object({
	inviteId: z.string().min(1),
});

export const getPendingDiscordInvites = adminProcedure
	.route({
		method: "GET",
		path: "/admin/discord/pending-invites",
		tags: ["Administration"],
		summary: "Get pending Discord invites",
	})
	.input(GetPendingInvitesInputSchema)
	.handler(async ({ input }) => {
		const where = input.status ? { status: input.status } : {};

		const invites = await db.pendingDiscordInvite.findMany({
			where,
			include: {
				primaryUser: {
					select: {
						id: true,
						name: true,
						email: true,
					},
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return { invites };
	});

export const cancelPendingDiscordInvite = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/cancel-pending-invite",
		tags: ["Administration"],
		summary: "Cancel a pending Discord invite",
	})
	.input(CancelInviteInputSchema)
	.handler(async ({ input, context }) => {
		const invite = await db.pendingDiscordInvite.findUnique({
			where: { id: input.inviteId },
		});

		if (!invite) {
			throw new ORPCError("NOT_FOUND", {
				message: "Pending invite not found",
			});
		}

		if (invite.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only pending invites can be cancelled",
			});
		}

		await db.pendingDiscordInvite.update({
			where: { id: input.inviteId },
			data: { status: "expired" },
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: invite.primaryUserId,
			summary: `Canceled pending Discord invite to ${invite.recipientEmail}`,
			metadata: {
				action: "cancel_discord_invite",
				inviteId: invite.id,
				recipientEmail: invite.recipientEmail,
			},
		});

		return { success: true };
	});

export const resendDiscordInvite = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/resend-pending-invite",
		tags: ["Administration"],
		summary: "Resend a Discord invite (creates new invite, expires old one)",
	})
	.input(ResendInviteInputSchema)
	.handler(async ({ input, context }) => {
		const invite = await db.pendingDiscordInvite.findUnique({
			where: { id: input.inviteId },
			include: {
				primaryUser: true,
			},
		});

		if (!invite) {
			throw new ORPCError("NOT_FOUND", {
				message: "Pending invite not found",
			});
		}

		if (invite.status !== "pending") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only pending invites can be resent",
			});
		}

		const { primaryUserId, recipientEmail, relationship } = invite;

		// Expire the old invite
		await db.pendingDiscordInvite.update({
			where: { id: input.inviteId },
			data: { status: "expired" },
		});

		// Create new invite record
		const inviteCode = randomBytes(16).toString("hex");
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		const newInvite = await db.pendingDiscordInvite.create({
			data: {
				primaryUserId,
				inviteCode,
				recipientEmail,
				relationship,
				expiresAt,
				createdBy: context.user.id,
			},
		});

		// Create new Discord invite
		const { createTemporaryInvite } = await import("@repo/discord");
		const inviteResult = await createTemporaryInvite(
			604800, // 7 days
			1, // Single use
		);

		if (!inviteResult.success || !inviteResult.inviteUrl) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: `Failed to create Discord invite: ${inviteResult.error}`,
			});
		}

		// Send email
		try {
			const { sendEmail } = await import("@repo/mail");
			await sendEmail({
				to: recipientEmail,
				templateId: "discordInvite",
				context: {
					recipientName: recipientEmail.split("@")[0],
					primaryUserName: invite.primaryUser?.name || "a member",
					discordInviteUrl: inviteResult.inviteUrl,
					expiresAt,
				},
			});
		} catch (error) {
			logger.error("Failed to send Discord invite email on resend", {
				recipientEmail,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: primaryUserId,
			summary: `Resent Discord invite to ${recipientEmail}`,
			metadata: {
				action: "resend_discord_invite",
				originalInviteId: input.inviteId,
				newInviteId: newInvite.id,
				recipientEmail,
			},
		});

		return {
			success: true,
			message: "Invite resent successfully",
			expiresAt,
		};
	});
