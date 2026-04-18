import { ORPCError } from "@orpc/server";
import { randomBytes } from "crypto";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { logger } from "@repo/logs";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const SendDiscordInviteInputSchema = z.object({
	primaryUserId: z.string().min(1),
	recipientEmail: z.string().email(),
	relationship: z.enum(["spouse", "partner", "family"]),
});

export const sendDiscordInvite = adminProcedure
	.route({
		method: "POST",
		path: "/admin/users/send-discord-invite",
		tags: ["Administration"],
		summary: "Send Discord invite for spouse/additional account",
	})
	.input(SendDiscordInviteInputSchema)
	.handler(async ({ input, context }) => {
		const { primaryUserId, recipientEmail, relationship } = input;

		// Verify primary user has active access
		const primaryUser = await db.user.findUnique({
			where: { id: primaryUserId },
			include: {
				purchases: {
					where: {
						status: { in: ["active", "grace_period"] },
					},
				},
			},
		});

		if (!primaryUser) {
			throw new ORPCError("NOT_FOUND", { message: "Primary user not found" });
		}

		if (primaryUser.purchases.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Primary user does not have active access",
			});
		}

		// Check for existing pending invite
		const existingPending = await db.pendingDiscordInvite.findFirst({
			where: {
				primaryUserId,
				recipientEmail,
				status: "pending",
				expiresAt: { gt: new Date() },
			},
		});

		if (existingPending) {
			throw new ORPCError("CONFLICT", {
				message: "Pending invite already exists for this email",
			});
		}

		// Generate unique invite code
		const inviteCode = randomBytes(16).toString("hex");

		// Calculate expiration (7 days)
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);

		// Create invite
		const invite = await db.pendingDiscordInvite.create({
			data: {
				primaryUserId,
				inviteCode,
				recipientEmail,
				relationship,
				expiresAt,
				createdBy: context.user.id,
			},
		});

		// Log admin action
		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: primaryUserId,
			summary: `Queued Discord invite to ${recipientEmail} (${relationship})`,
			metadata: {
				action: "send_discord_invite",
				recipientEmail,
				relationship,
				inviteId: invite.id,
			},
		});

	// Create a temporary Discord invite (7 days, single use)
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

	// Log the invite URL for tracking
	await logAdminAction({
		adminUserId: context.user.id,
		action: "SYSTEM_ACTION",
		targetType: "user",
		targetId: primaryUserId,
		summary: `Created Discord invite link for ${recipientEmail}`,
		metadata: {
			action: "discord_invite_created",
			inviteCode: inviteResult.inviteCode,
			inviteUrl: inviteResult.inviteUrl,
			recipientEmail,
		},
	});

	// Send email with the temporary invite link
	try {
		const { sendEmail } = await import("@repo/mail");

		await sendEmail({
			to: recipientEmail,
			templateId: "discordInvite",
			context: {
				recipientName: recipientEmail.split("@")[0],
				primaryUserName: primaryUser.name || "a member",
				discordInviteUrl: inviteResult.inviteUrl,
				expiresAt,
			},
		});
	} catch (error) {
		logger.error("Failed to send Discord invite email", {
			recipientEmail,
			error: error instanceof Error ? error.message : String(error),
		});
		// Don't fail the whole operation if email fails
	}

		return {
			success: true,
			message: "Discord invite sent successfully",
			inviteCode,
			expiresAt,
		};
	});

