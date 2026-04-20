import { config } from "@repo/config";
import {
	db,
	getInvitationById,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	getUserByEmail,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import {
	admin,
	createAuthMiddleware,
	magicLink,
	openAPI,
	twoFactor,
	username,
} from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";
import { parse as parseCookies } from "cookie";
import { generateCSRFToken } from "./lib/csrf";
import { handleDiscordOAuthCallback } from "./lib/discord-oauth-hook";
import { updateSeatsInOrganizationSubscription } from "./lib/organization";
import { ac, adminRole, ownerRole } from "./permissions";
import { invitationOnlyPlugin } from "./plugins/invitation-only";

const getLocaleFromRequest = (request?: Request) => {
	const cookies = parseCookies(request?.headers.get("cookie") ?? "");
	return (
		(cookies[config.i18n.localeCookieName] as Locale) ??
		config.i18n.defaultLocale
	);
};

const appUrl = getBaseUrl();

const additionalTrustedOrigins = [
	"https://lifepreneur.io",
	"https://www.lifepreneur.io",
].filter((origin) => origin !== appUrl);

export const auth = betterAuth({
	baseURL: appUrl,
	trustedOrigins: [appUrl, ...additionalTrustedOrigins],
	appName: config.appName,
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	advanced: {
		database: {
			generateId: false,
		},
	},
	session: {
		expiresIn: config.auth.sessionCookieMaxAge,
		freshAge: 0,
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "github", "discord", "tiktok"],
			// Allow linking social accounts (Discord) even when emails don't match
			// Safe for our use case: users purchase with one email, Discord has another
			// Primary auth is via purchase email, Discord is just for server access
			allowDifferentEmails: true,
		},
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			// GLOBAL PAYWALL: Block ALL account creation except through Stripe webhook
			// Magic link, OAuth, email signup - none should create new accounts
			const signupPaths = ["/sign-up", "/sign-in/magic-link"];

			if (signupPaths.some((path) => ctx.path.startsWith(path))) {
				const email = ctx.body?.email;

				if (email) {
					const existingUser = await getUserByEmail(email);

					if (!existingUser) {
						throw new APIError("BAD_REQUEST", {
							code: "ACCOUNT_NOT_FOUND",
							message:
								"No account found with this email. Please purchase a subscription first.",
						});
					}
				}
			}

			// Prevent Google OAuth from creating NEW accounts (paywall protection)
			if (ctx.path.startsWith("/callback/google")) {
				// Extract email from the OAuth callback data
				const email = ctx.body?.email || ctx.body?.user?.email;

				if (email) {
					const existingUser = await getUserByEmail(email);

					if (!existingUser) {
						// Reject - no account exists, must purchase first
						throw new Error(
							"No account found. Please purchase a subscription first at the pricing page.",
						);
					}
					// If user exists, allow the OAuth flow to continue
				}
			}

			// Existing before hooks
			if (
				ctx.path.startsWith("/delete-user") ||
				ctx.path.startsWith("/organization/delete")
			) {
				const userId = ctx.context.session?.session.userId;
				const { organizationId } = ctx.body;

				if (userId || organizationId) {
					const purchases = organizationId
						? await getPurchasesByOrganizationId(organizationId)
						: // biome-ignore lint/style/noNonNullAssertion: This is a valid case
							await getPurchasesByUserId(userId!);
					const subscriptions = purchases.filter(
						(purchase) =>
							purchase.type === "SUBSCRIPTION" &&
							purchase.subscriptionId !== null,
					);

					if (subscriptions.length > 0) {
						for (const subscription of subscriptions) {
							await cancelSubscription(
								// biome-ignore lint/style/noNonNullAssertion: This is a valid case
								subscription.subscriptionId!,
							);
						}
					}
				}
			}
		}),
		after: createAuthMiddleware(async (ctx) => {
			const isProduction = process.env.NODE_ENV === "production";

			// Email change history: log when a user initiates an email change.
			// At this point the old email is still current in the DB.
			if (ctx.path.startsWith("/change-email")) {
				const userId = ctx.context.session?.session?.userId;
				const newEmail = (ctx.body as Record<string, unknown>)
					?.newEmail as string | undefined;
				if (userId && newEmail) {
					const currentUser = await db.user.findUnique({
						where: { id: userId },
						select: { email: true },
					});
					if (currentUser && currentUser.email !== newEmail) {
						await db.userEmailHistory
							.create({
								data: {
									userId,
									oldEmail: currentUser.email,
									newEmail,
								},
							})
							.catch((err) => {
								logger.error(
									"Failed to log email change history",
									{
										userId,
										error:
											err instanceof Error
												? err.message
												: String(err),
									},
								);
							});
					}
				}
			}

			// Email change confirmation: when the user clicks the verification link,
			// better-auth updates the email in the DB then this after-hook runs.
			// Mark the matching UserEmailHistory record as confirmed.
			if (ctx.path.startsWith("/verify-email")) {
				const userId =
					ctx.context.session?.session?.userId ??
					(ctx.context as Record<string, any>).newSession?.session
						?.userId;
				if (userId) {
					const user = await db.user.findUnique({
						where: { id: userId },
						select: { email: true },
					});
					if (user) {
						await db.userEmailHistory
							.updateMany({
								where: {
									userId,
									newEmail: user.email,
									confirmed: false,
								},
								data: {
									confirmed: true,
									confirmedAt: new Date(),
								},
							})
							.catch((err) => {
								logger.error(
									"Failed to confirm email change history",
									{
										userId,
										error:
											err instanceof Error
												? err.message
												: String(err),
									},
								);
							});
					}
				}
			}

			// CSRF Protection: Set CSRF cookies on successful email login
			if (ctx.path.startsWith("/sign-in/email")) {
				const token = generateCSRFToken();
				// Use ctx.setCookie to properly append multiple Set-Cookie headers
				ctx.setCookie("csrf-token", token, {
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					maxAge: 86400, // 24 hours
				});
				ctx.setCookie("csrf-token-read", token, {
					httpOnly: false,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					maxAge: 86400, // 24 hours
				});
			}

			// CSRF Protection: Set CSRF cookies on impersonation
			if (ctx.path.startsWith("/admin/impersonate-user")) {
				const token = generateCSRFToken();
				ctx.setCookie("csrf-token", token, {
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					maxAge: 86400, // 24 hours
				});
				ctx.setCookie("csrf-token-read", token, {
					httpOnly: false,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					maxAge: 86400, // 24 hours
				});
			}

			// TikTok OAuth callback - store account data for the dashboard
			if (ctx.path.startsWith("/callback/tiktok")) {
				const userId = ctx.context.session?.session?.userId;
				if (userId) {
					logger.info("TikTok OAuth callback completed", { userId });
				}
			}

			// Discord OAuth callback - grant Discord access after successful connection
			if (ctx.path.startsWith("/callback/discord")) {
				// Get the user ID from the session or response
				const userId = ctx.context.session?.session?.userId;
				if (userId) {
					// Handle Discord OAuth callback asynchronously
					// Don't await to not block the OAuth callback response
					handleDiscordOAuthCallback(userId).catch((error) => {
						logger.error(
							"Failed to handle Discord OAuth callback",
							{
								userId,
								error:
									error instanceof Error
										? error.message
										: String(error),
							},
						);
					});
				}
			}

			// Existing organization hooks
			if (ctx.path.startsWith("/organization/accept-invitation")) {
				const { invitationId } = ctx.body;

				if (!invitationId) {
					return;
				}

				const invitation = await getInvitationById(invitationId);

				if (!invitation) {
					return;
				}

				await updateSeatsInOrganizationSubscription(
					invitation.organizationId,
				);
			} else if (ctx.path.startsWith("/organization/remove-member")) {
				const { organizationId } = ctx.body;

				if (!organizationId) {
					return;
				}

				await updateSeatsInOrganizationSubscription(organizationId);
			}
		}),
	},
	user: {
		additionalFields: {
			onboardingComplete: {
				type: "boolean",
				required: false,
				input: false,
			},
			locale: {
				type: "string",
				required: false,
			},
			// Discord Integration (Phase 1)
			discordId: {
				type: "string",
				required: false,
				input: false,
			},
			discordUsername: {
				type: "string",
				required: false,
				input: false,
			},
			discordConnected: {
				type: "boolean",
				required: false,
				input: false,
			},
			discordConnectedAt: {
				type: "date",
				required: false,
				input: false,
			},
			// Referral Tracking (Phase 1)
			referredBy: {
				type: "string",
				required: false,
				input: false,
			},
			referredBySlug: {
				type: "string",
				required: false,
				input: false,
			},
			referralSource: {
				type: "string",
				required: false,
				input: false,
			},
			// Notification email
			notificationEmail: {
				type: "string",
				required: false,
			},
			// Beta Feature Flags
			betaFeatures: {
				type: "array" as any,
				required: false,
				input: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async (
				{ user: { email, name }, url },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: email,
					templateId: "emailVerification",
					context: {
						url,
						name,
					},
					locale,
				});
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		// If signup is disabled, the only way to sign up is via an invitation. So in this case we can auto sign in the user, as the email is already verified by the invitation.
		// If signup is enabled, we can't auto sign in the user, as the email is not verified yet.
		autoSignIn: !config.auth.enableSignup,
		requireEmailVerification: config.auth.enableSignup,
		sendResetPassword: async ({ user, url }, request) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: user.email,
				templateId: "forgotPassword",
				context: {
					url,
					name: user.name,
				},
				locale,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: config.auth.enableSignup,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async (
			{ user: { email, name }, url },
			request,
		) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: email,
				templateId: "emailVerification",
				context: {
					url,
					name,
				},
				locale,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
			scope: ["email", "profile"],
		},
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
			scope: ["identify", "email", "guilds.join"],
		},
		tiktok: {
			clientKey: "6jjfrcpb4dlug",
			clientSecret: process.env.TIKTOK_APP_SECRET!,
		},
	},
	plugins: [
		username(),
		admin({
			defaultRole: "user",
			ac,
			roles: {
				owner: ownerRole,
				admin: adminRole,
			},
		}),
		passkey(),
		magicLink({
			disableSignUp: true,
			sendMagicLink: async ({ email, url }, request) => {
				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: email,
					templateId: "magicLink",
					context: {
						url,
					},
					locale,
				});
			},
		}),
		openAPI(),
		invitationOnlyPlugin(),
		twoFactor(),
	],
	onAPIError: {
		onError(error, ctx) {
			logger.error(error, { ctx });
		},
	},
});

export * from "./lib/organization";

export type Session = typeof auth.$Infer.Session;
