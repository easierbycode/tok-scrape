import { routing } from "@i18n/routing";
import { config as appConfig } from "@repo/config";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function proxy(req: NextRequest) {
	const { pathname, origin } = req.nextUrl;

	// --- Maintenance Mode Check ---
	// These paths are always accessible regardless of maintenance state.
	// /auth allows admin/owner to log in. /admin lets them manage the site.
	const maintenanceBypass = [
		"/api/health",
		"/api/auth",
		"/api/admin/maintenance",
		"/_next",
		"/favicon",
		"/images",
		"/maintenance",
		"/auth",
		"/admin",
	];
	const isMaintenanceBypass = maintenanceBypass.some((path) =>
		pathname.startsWith(path),
	);

	// Resolve whether maintenance is active (env var or DB-backed flag)
	let maintenanceActive = appConfig.maintenance.enabled;
	if (!maintenanceActive && !isMaintenanceBypass) {
		try {
			const res = await fetch(
				`${req.nextUrl.origin}/api/admin/maintenance`,
				{
					headers: { cookie: req.headers.get("cookie") ?? "" },
					cache: "no-store",
				},
			);
			if (res.ok) {
				const data = (await res.json()) as { enabled?: boolean };
				maintenanceActive = data.enabled ?? false;
			}
		} catch {
			// DB down — env var is the fallback
		}
	}

	if (maintenanceActive && !isMaintenanceBypass) {
		// Allow admin and owner roles through so they can see and fix the site
		const sessionCookie = getSessionCookie(req);
		if (sessionCookie) {
			try {
				const res = await fetch(
					`${req.nextUrl.origin}/api/auth/get-session`,
					{
						headers: { cookie: req.headers.get("cookie") ?? "" },
						cache: "no-store",
					},
				);
				if (res.ok) {
					const data = (await res.json()) as {
						user?: { role?: string };
					};
					const role = data?.user?.role;
					if (role === "admin" || role === "owner") {
						// Fall through — let the request continue normally
					} else {
						return NextResponse.redirect(
							new URL("/maintenance", origin),
						);
					}
				} else {
					return NextResponse.redirect(
						new URL("/maintenance", origin),
					);
				}
			} catch {
				return NextResponse.redirect(new URL("/maintenance", origin));
			}
		} else {
			return NextResponse.redirect(new URL("/maintenance", origin));
		}
	}

	const sessionCookie = getSessionCookie(req);

	if (pathname.startsWith("/app")) {
		const response = NextResponse.next();

		if (!appConfig.ui.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		// Auth check - redirect to login if no session
		if (!sessionCookie) {
			return NextResponse.redirect(
				new URL(
					`/auth/login?redirectTo=${encodeURIComponent(pathname)}`,
					origin,
				),
			);
		}

		return response;
	}

	if (pathname.startsWith("/auth")) {
		if (!appConfig.ui.saas.enabled) {
			return NextResponse.redirect(new URL("/", origin));
		}

		return NextResponse.next();
	}

	const pathsWithoutLocale = [
		"/admin",
		"/auth",
		"/onboarding",
		"/new-organization",
		"/choose-plan",
		"/organization-invitation",
		"/maintenance",
		"/r",
	];

	if (pathsWithoutLocale.some((path) => pathname.startsWith(path))) {
		return NextResponse.next();
	}

	if (!appConfig.ui.marketing.enabled) {
		return NextResponse.redirect(new URL("/app", origin));
	}

	return intlMiddleware(req);
}

export const config = {
	matcher: [
		"/((?!api|image-proxy|images|fonts|_next/static|_next/image|favicon.ico|icon.png|sitemap.xml|robots.txt).*)",
	],
};
