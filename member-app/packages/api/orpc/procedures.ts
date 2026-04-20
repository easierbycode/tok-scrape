import crypto from "node:crypto";
import { ORPCError, os } from "@orpc/server";
import { auth } from "@repo/auth";
import { validateCSRFToken } from "@repo/auth/lib/csrf";
import { logger } from "@repo/logs";
import {
	canAccessCommandCenter,
	canUseAdminProcedure,
	canUseAnalyticsProcedure,
} from "../lib/roles";

export const publicProcedure = os.$context<{
	headers: Headers;
	request: {
		method: string;
	};
}>();

export const protectedProcedure = publicProcedure.use(
	async ({ context, next }) => {
		const session = await auth.api.getSession({
			headers: context.headers,
		});

		if (!session) {
			throw new ORPCError("UNAUTHORIZED");
		}

		return await next({
			context: {
				session: session.session,
				user: session.user,
			},
		});
	},
);

export const adminProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const requestId = crypto.randomUUID();

		// Check super admin with case-insensitive comparison
		const superAdmins =
			process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
				e.trim().toLowerCase(),
			) || [];
		const isSuperAdmin = superAdmins.includes(
			context.user.email.toLowerCase(),
		);

		const isAdmin = canUseAdminProcedure(context.user.role);

		if (!isSuperAdmin && !isAdmin) {
			logger.warn("Admin access denied", {
				requestId,
				userId: context.user.id,
				email: context.user.email,
				role: context.user.role,
			});
			throw new ORPCError("FORBIDDEN", {
				message: "Admin access required",
			});
		}

		// Validate CSRF on mutations (not GET)
		const method = context.request.method;
		if (method !== "GET") {
			const cookieHeader = context.headers.get("cookie") || "";
			const csrfHeader = context.headers.get("x-csrf-token") || "";

			if (!validateCSRFToken(cookieHeader, csrfHeader)) {
				logger.error("CSRF validation failed", {
					requestId,
					userId: context.user.id,
					method,
					hasCookie: !!cookieHeader,
					hasHeader: !!csrfHeader,
				});

				throw new ORPCError("FORBIDDEN", {
					message: "Invalid CSRF token",
				});
			}
		}

		return next({
			context: {
				...context,
				requestId,
				isSuperAdmin,
			},
		});
	},
);

/** Analytics hub + read-only metrics; no CSRF (GET-only routes). */
export const analyticsProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const requestId = crypto.randomUUID();

		const superAdmins =
			process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
				e.trim().toLowerCase(),
			) || [];
		const isSuperAdmin = superAdmins.includes(
			context.user.email.toLowerCase(),
		);

		if (!canUseAnalyticsProcedure(context.user.role, isSuperAdmin)) {
			logger.warn("Analytics access denied", {
				requestId,
				userId: context.user.id,
				email: context.user.email,
				role: context.user.role,
			});
			throw new ORPCError("FORBIDDEN", {
				message: "Analytics access required",
			});
		}

		return next({
			context: {
				...context,
				requestId,
				isSuperAdmin,
			},
		});
	},
);

/** Command Center metrics; owner + super-admin only. */
export const ownerProcedure = protectedProcedure.use(
	async ({ context, next }) => {
		const requestId = crypto.randomUUID();

		const superAdmins =
			process.env.SUPER_ADMIN_EMAILS?.split(",").map((e) =>
				e.trim().toLowerCase(),
			) || [];
		const isSuperAdmin = superAdmins.includes(
			context.user.email.toLowerCase(),
		);

		if (!canAccessCommandCenter(context.user.role, isSuperAdmin)) {
			logger.warn("Owner command center access denied", {
				requestId,
				userId: context.user.id,
				email: context.user.email,
				role: context.user.role,
			});
			throw new ORPCError("FORBIDDEN", {
				message: "Owner access required",
			});
		}

		const method = context.request.method;
		if (method !== "GET") {
			const cookieHeader = context.headers.get("cookie") || "";
			const csrfHeader = context.headers.get("x-csrf-token") || "";

			if (!validateCSRFToken(cookieHeader, csrfHeader)) {
				logger.error("CSRF validation failed", {
					requestId,
					userId: context.user.id,
					method,
					hasCookie: !!cookieHeader,
					hasHeader: !!csrfHeader,
				});

				throw new ORPCError("FORBIDDEN", {
					message: "Invalid CSRF token",
				});
			}
		}

		return next({
			context: {
				...context,
				requestId,
				isSuperAdmin,
			},
		});
	},
);
