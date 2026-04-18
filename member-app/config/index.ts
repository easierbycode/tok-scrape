import type { Config } from "./types";

export const config = {
	appName: "LifePreneur",
	// Internationalization
	i18n: {
		// Whether internationalization should be enabled (if disabled, you still need to define the locale you want to use below and set it as the default locale)
		enabled: false,
		// Define all locales here that should be available in the app
		// You need to define a label that is shown in the language selector and a currency that should be used for pricing with this locale
		locales: {
			en: {
				currency: "USD",
				label: "English",
			},
		},
		// The default locale is used if no locale is provided
		defaultLocale: "en",
		// The default currency is used for pricing if no currency is provided
		defaultCurrency: "USD",
		// The name of the cookie that is used to determine the locale
		localeCookieName: "NEXT_LOCALE",
	},
	// Organizations
	organizations: {
		// Whether organizations are enabled in general
		enable: false,
		// Whether billing for organizations should be enabled (below you can enable it for users instead)
		enableBilling: false,
		// Whether the organization should be hidden from the user (use this for multi-tenant applications)
		hideOrganization: false,
		// Should users be able to create new organizations? Otherwise only admin users can create them
		enableUsersToCreateOrganizations: true,
		// Whether users should be required to be in an organization. This will redirect users to the organization page after sign in
		requireOrganization: false,
		// Define forbidden organization slugs. Make sure to add all paths that you define as a route after /app/... to avoid routing issues
		forbiddenOrganizationSlugs: [
			"new-organization",
			"admin",
			"settings",
			"ai-demo",
			"organization-invitation",
		],
	},
	// Users
	users: {
		// Whether billing should be enabled for users (above you can enable it for organizations instead)
		enableBilling: true,
		// Whether you want the user to go through an onboarding form after signup (can be defined in the OnboardingForm.tsx)
		enableOnboarding: true,
	},
	// Authentication
	auth: {
		// Whether users should be able to create accounts (otherwise users can only be by admins)
		// Disabled: Accounts are created after Stripe purchase, not via public signup
		enableSignup: false,
		// Whether users should be able to sign in with a magic link
		enableMagicLink: true,
		// Whether users should be able to sign in with a social provider
		enableSocialLogin: true,
		// Whether users should be able to sign in with a passkey
		enablePasskeys: true,
		// Whether users should be able to sign in with a password
		enablePasswordLogin: true,
		// Whether users should be activate two factor authentication
		enableTwoFactor: true,
		// where users should be redirected after the sign in
		redirectAfterSignIn: "/app",
		// where users should be redirected after logout
		redirectAfterLogout: "/auth/login",
		// how long a session should be valid
		sessionCookieMaxAge: 60 * 60 * 24 * 30,
	},
	// Mails
	mails: {
		// the from address for mails
		from: "auth@lifepreneur.io",
	},
	// Frontend
	ui: {
		// the themes that should be available in the app
		enabledThemes: ["light", "dark"],
		// the default theme
		defaultTheme: "system",
		// the saas part of the application
		saas: {
			// whether the saas part should be enabled (otherwise all routes will be redirect to the marketing page)
			enabled: true,
			// whether the sidebar layout should be used
			useSidebarLayout: true,
		},
		// the marketing part of the application
		marketing: {
			// whether the marketing features should be enabled (otherwise all routes will be redirect to the saas part)
			enabled: true,
		},
	},
	// Storage
	storage: {
		// define the name of the buckets for the different types of files
		bucketNames: {
			avatars: process.env.NEXT_PUBLIC_AVATARS_BUCKET_NAME ?? "avatars",
			testimonials:
				process.env.NEXT_PUBLIC_TESTIMONIALS_BUCKET_NAME ??
				"testimonials",
			marketing:
				process.env.NEXT_PUBLIC_MARKETING_BUCKET_NAME ?? "marketing",
		},
	},
	maintenance: {
		enabled: process.env.MAINTENANCE_MODE === "true",
		message:
			process.env.MAINTENANCE_MESSAGE ??
			"We're performing scheduled maintenance. We'll be back shortly!",
		allowedEmails:
			process.env.MAINTENANCE_ALLOWED_EMAILS?.split(",").map((e) =>
				e.trim(),
			) ?? [],
		estimatedEndTime: process.env.MAINTENANCE_END_TIME,
	},
	contactForm: {
		// whether the contact form should be enabled
		enabled: true,
		// the email to which the contact form messages should be sent
		to: "support@lifepreneur.com",
		// the subject of the email
		subject: "Contact form message",
	},
	// Payments
	payments: {
		// define the products that should be available in the checkout
		plans: {
			// The free plan is treated differently. It will automatically be assigned if the user has no other plan.
			free: {
				isFree: true,
			},
			starter_monthly: {
				recommended: false,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY as string,
						interval: "month",
						amount: 49,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			creator_monthly: {
				recommended: true,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_CREATOR_MONTHLY as string,
						interval: "month",
						amount: 99,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			streamer_monthly: {
				recommended: false,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_STREAMER_MONTHLY as string,
						interval: "month",
						amount: 149,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			partner_monthly: {
				recommended: false,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_PARTNER_MONTHLY as string,
						interval: "month",
						amount: 199,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			// Legacy Pro — keep until no active purchases use these Stripe price IDs
			pro: {
				hidden: true,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY as string,
						interval: "month",
						amount: 99,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_PRO_YEARLY as string,
						interval: "year",
						amount: 997,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			test_daily: {
				hidden: true,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_TEST_DAILY as string,
						interval: "day",
						intervalCount: 1,
						amount: 1,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			test_2day: {
				hidden: true,
				prices: [
					{
						type: "recurring",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_TEST_2DAY as string,
						interval: "day",
						intervalCount: 2,
						amount: 2,
						currency: "USD",
						seatBased: false,
						trialPeriodDays: 0,
					},
				],
			},
			lifetime: {
				hidden: true,
				prices: [
					{
						type: "one-time",
						productId: process.env
							.NEXT_PUBLIC_PRICE_ID_LIFETIME as string,
						amount: 997,
						currency: "USD",
					},
				],
			},
			manual_override: {
				hidden: true,
			},
			no_active_plan: {
				hidden: true,
			},
		},
	},
} as const satisfies Config;

export type { Config };
