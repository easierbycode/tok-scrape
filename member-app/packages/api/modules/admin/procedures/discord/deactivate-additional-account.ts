import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logAdminAction } from "@repo/database/lib/audit-logger";
import { z } from "zod";
import { adminProcedure } from "../../../../orpc/procedures";

const DeactivateInputSchema = z.object({
	accountId: z.string(),
});

export const deactivateAdditionalAccount = adminProcedure
	.route({
		method: "POST",
		path: "/admin/discord/deactivate-additional-account",
		tags: ["Administration"],
		summary: "Deactivate an additional Discord account",
	})
	.input(DeactivateInputSchema)
	.handler(async ({ input, context }) => {
		const { accountId } = input;

		const account = await db.additionalDiscordAccount.findUnique({
			where: { id: accountId },
		});

		if (!account) {
			throw new ORPCError("NOT_FOUND", { message: "Account not found" });
		}

		await db.additionalDiscordAccount.update({
			where: { id: accountId },
			data: { active: false },
		});

		await logAdminAction({
			adminUserId: context.user.id,
			action: "SYSTEM_ACTION",
			targetType: "user",
			targetId: account.primaryUserId,
			summary: `Deactivated additional Discord account ${account.discordId}`,
			metadata: {
				action: "deactivate_additional_discord_account",
				accountId,
				discordId: account.discordId,
			},
		});

		return { success: true };
	});

