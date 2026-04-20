"use server";

import { canUseAdminProcedure } from "@repo/api/lib/roles";
import { logger } from "@repo/logs";
import { getSession } from "@saas/auth/lib/server";
import { revalidatePath, revalidateTag } from "next/cache";

async function requireAdmin(): Promise<boolean> {
	const session = await getSession();
	if (!session?.user) {
		return false;
	}
	const superAdmins =
		process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
			e.trim().toLowerCase(),
		) || [];
	const isSuperAdmin = superAdmins.includes(session.user.email.toLowerCase());
	return isSuperAdmin || canUseAdminProcedure(session.user.role);
}

export const clearCache = async (path?: string) => {
	if (!(await requireAdmin())) {
		return;
	}
	try {
		if (path) {
			revalidatePath(path);
		} else {
			revalidatePath("/", "layout");
		}
	} catch (error) {
		logger.error("Could not revalidate path", { path, error });
	}
};

export const clearMarketingCache = async () => {
	if (!(await requireAdmin())) {
		return;
	}
	try {
		revalidateTag("marketing-content", {});
		revalidateTag("pricing-plans", {});
		revalidatePath("/");
	} catch (error) {
		logger.error("Could not revalidate marketing cache", { error });
	}
};
