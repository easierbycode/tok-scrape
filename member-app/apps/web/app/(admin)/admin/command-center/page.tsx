import { canAccessCommandCenter } from "@repo/api/lib/roles";
import { checkIsSuperAdmin } from "@saas/admin/lib/super-admin";
import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import { CommandCenterDashboard } from "./command-center-dashboard";

export default async function CommandCenterPage() {
	const session = await getSession();
	if (!session?.user) {
		redirect("/auth/login");
	}

	const isSuperAdmin = checkIsSuperAdmin(session.user.email);

	if (!canAccessCommandCenter(session.user.role, isSuperAdmin)) {
		redirect("/admin");
	}

	return <CommandCenterDashboard />;
}
