import { db } from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const completeOnboarding = protectedProcedure
	.route({
		method: "POST",
		path: "/users/complete-onboarding",
		tags: ["Users"],
		summary: "Mark onboarding as complete for the current user",
	})
	.handler(async ({ context }) => {
		await db.user.update({
			where: { id: context.user.id },
			data: { onboardingComplete: true },
		});

		return { success: true as const };
	});
