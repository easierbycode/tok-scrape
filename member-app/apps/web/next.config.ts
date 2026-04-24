import { withContentCollections } from "@content-collections/next";
// @ts-expect-error - PrismaPlugin is not typed
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");

const nextConfig: NextConfig = {
	// Expose Vercel deployment target to the browser so PostHog (and similar) can
	// gate capture to production only. Preview/local builds are not "production".
	env: {
		NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? "",
	},
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/database",
		"@repo/discord",
	],
	// Externalize discord.js and its optional native dependencies for server-side use
	serverExternalPackages: ["discord.js", "@discordjs/ws", "@discordjs/rest"],
	images: {
		remotePatterns: [
			{
				// google profile images
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				// github profile images
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				// supabase storage
				protocol: "https",
				hostname: "lcmvnbbeywidktxvjbit.storage.supabase.co",
			},
			{
				// placeholder thumbnails (content library demo data)
				protocol: "https",
				hostname: "placehold.co",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/app/settings",
				destination: "/app/settings/general",
				permanent: true,
			},
			{
				source: "/app/:organizationSlug/settings",
				destination: "/app/:organizationSlug/settings/general",
				permanent: true,
			},
			{
				source: "/app/admin",
				destination: "/app/admin/users",
				permanent: true,
			},
		];
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
					{
						key: "Content-Security-Policy",
						value: [
							"default-src 'self'",
							// Removed 'unsafe-eval' for better security (not required by Rewardful or Vercel Analytics)
							"script-src 'self' 'unsafe-inline' https://r.wdfl.co https://*.i.posthog.com",
							"style-src 'self' 'unsafe-inline'",
							"img-src 'self' blob: data: https:",
							"media-src 'self' https:",
							"font-src 'self' data:",
							"connect-src 'self' blob: https://*.supabase.co https://*.stripe.com https://r.wdfl.co https://api.getrewardful.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.i.posthog.com",
							"frame-src 'self' https://*.stripe.com https://www.youtube.com https://www.youtube-nocookie.com https://us.posthog.com",
						].join("; "),
					},
				],
			},
		];
	},
	webpack: (config, { webpack, isServer }) => {
		config.plugins.push(
			new webpack.IgnorePlugin({
				// Ignore optional native dependencies that aren't needed
				resourceRegExp:
					/^pg-native$|^cloudflare:sockets$|^zlib-sync$|^bufferutil$|^utf-8-validate$|^erlpack$/,
			}),
		);

		if (isServer) {
			config.plugins.push(new PrismaPlugin());
		}

		return config;
	},
};

// Note: withSentryConfig is not used here because it breaks Turbopack builds
// with Next.js 16. Sentry still works via runtime initialization files:
// - instrumentation-client.ts (client-side)
// - sentry.server.config.ts (server-side)
// - sentry.edge.config.ts (edge runtime)
// Source map uploads can be configured separately via Sentry CLI in CI.
export default withContentCollections(withNextIntl(nextConfig));
