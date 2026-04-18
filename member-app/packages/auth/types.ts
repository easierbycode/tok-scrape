import type { auth } from "./auth";

// Better-Auth type inference for session (not exported to avoid conflict)
type Session = typeof auth.$Infer.Session;

// Explicit type augmentation for TypeScript strict mode
// All these fields are defined in auth.ts additionalFields and should auto-infer,
// but we make them explicit for tsc --noEmit and pnpm build
export interface BetterAuthUser {
	// Base Better-Auth fields
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	image?: string | null;
	createdAt: Date;
	updatedAt: Date;

	// Custom additionalFields from auth.ts
	onboardingComplete?: boolean;
	locale?: string;
	betaFeatures?: string[];

	// Notification email
	notificationEmail?: string | null;

	// Discord Integration
	discordId?: string | null;
	discordUsername?: string | null;
	discordConnected?: boolean;
	discordConnectedAt?: Date | null;

	// Referral Tracking
	referredBy?: string | null;
	referredBySlug?: string | null;
	referralSource?: string | null;

	// Plugin fields (from admin() and twoFactor() plugins)
	role?: string;
	twoFactorEnabled?: boolean;
}

// Re-export session type with explicit user type
export type ExtendedSession = {
	session: Session["session"];
	user: BetterAuthUser;
};
