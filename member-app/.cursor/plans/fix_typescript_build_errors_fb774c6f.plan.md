---
name: Fix TypeScript Build Errors
overview: Systematically fix 64 TypeScript errors blocking production build by following Better-Auth and Supastarter patterns. The errors are caused by strict TypeScript mode not properly inferring Better-Auth's additionalFields types. We'll add explicit type augmentation while maintaining the framework's conventions.
todos:
  - id: add-type-augmentation
    content: Create packages/auth/types.ts with explicit Better-Auth type definitions
    status: completed
  - id: export-types
    content: Update packages/auth/index.ts to export new types
    status: completed
    dependencies:
      - add-type-augmentation
  - id: fix-notifications-mutation
    content: Fix async wrapper in notifications page mutation function
    status: completed
    dependencies:
      - export-types
  - id: fix-null-safety
    content: Add null checks for user.role, onboardingComplete, discordConnected
    status: completed
    dependencies:
      - export-types
  - id: remove-organization-plugin
    content: Remove unused organization plugin from auth.ts and client.ts
    status: completed
    dependencies:
      - fix-notifications-mutation
  - id: fix-announcement-types
    content: Add type assertions for announcement form string unions
    status: completed
    dependencies:
      - fix-null-safety
  - id: fix-beta-feature-hook
    content: Remove type assertions from use-beta-feature hook
    status: completed
    dependencies:
      - export-types
  - id: fix-affiliate-null-checks
    content: Add null safety for affiliate dashboard data
    status: completed
    dependencies:
      - fix-null-safety
  - id: fix-add-user-dialog
    content: Fix userId property access in AddUserDialog
    status: completed
    dependencies:
      - fix-null-safety
  - id: verify-build
    content: Run pnpm build and verify 0 TypeScript errors
    status: completed
    dependencies:
      - fix-announcement-types
      - fix-beta-feature-hook
      - fix-affiliate-null-checks
      - fix-add-user-dialog
      - remove-organization-plugin
---

# Fix TypeScript Build Errors (Phase 8 - BCP8)

## Problem Analysis

The production build fails with 64 TypeScript errors, all related to Better-Auth session types not including our custom fields. Development mode works fine (Turbopack is lenient), but strict build mode (`pnpm build` and `tsc --noEmit`) fails.**Root Cause:** Better-Auth's `$Infer.Session` type inference works in development but doesn't propagate through strict TypeScript compilation.

## Error Categories

1. **Better-Auth Missing Fields** (~20 errors): `onboardingComplete`, `betaFeatures`, `role`, `discordConnected`, etc.
2. **String Union Types** (~10 errors): Form inputs returning `string` instead of `"welcome" | "feature"`
3. **Null Safety** (~10 errors): Properties accessed without null checks
4. **Organization Methods** (~10 errors): Unused organization plugin causing type errors
5. **Misc Type Mismatches** (~14 errors): Various ORPC and component type issues

---

## Implementation Plan

### Step 1: Add Explicit Type Augmentation

Better-Auth's type inference should work automatically via `inferAdditionalFields<typeof auth>()`, but TypeScript's strict mode needs explicit types.**Create:** [`packages/auth/types.ts`](packages/auth/types.ts)

```typescript
import type { auth } from "./auth";

// Better-Auth type inference for session
export type Session = typeof auth.$Infer.Session;

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
```

**Update:** [`packages/auth/index.ts`](packages/auth/index.ts)

```typescript
export * from "./auth";
export * from "./types"; // Add this line
```

---

### Step 2: Fix Immediate Build Blocker

The first error blocking the build is in the notifications page where the mutation function is missing an async wrapper.**Update:** [`apps/web/app/(saas)/app/(account)/notifications/page.tsx`](apps/web/app/\\\\(saas)/app/(account)/notifications/page.tsx)Line 26: Change from:

```typescript
mutationFn: () => orpc.users.notifications.markAllRead.mutate({})
```

To:

```typescript
mutationFn: async () => {
  await orpc.users.notifications.markAllRead.mutate({})
}
```

This matches the pattern already used in [`apps/web/modules/saas/shared/components/UserNotificationsDropdown.tsx`](apps/web/modules/saas/shared/components/UserNotificationsDropdown.tsx) (lines 36-38).---

### Step 3: Fix Null Safety Issues

Add null checks and defaults for optional user properties throughout the app.**Pattern to apply:**

```typescript
// BEFORE (causes TypeScript error)
const role = user.role;
const isAdmin = user.role === "admin";

// AFTER (null-safe with default)
const role = user.role ?? "user";
const isAdmin = role === "admin";
```

**Files to update:**

1. [`apps/web/app/(saas)/app/layout.tsx`](apps/web/app/\\\\(saas)/app/layout.tsx) - Line 23: Add null check for `onboardingComplete`
2. [`apps/web/app/(admin)/admin/layout.tsx`](apps/web/app/\\\\(admin)/admin/layout.tsx) - Add null check for `role`
3. [`apps/web/modules/saas/community/components/community-hub.tsx`](apps/web/modules/saas/community/components/community-hub.tsx) - Line 58: Add null check for `discordConnected`
4. [`apps/web/components/onboarding-redirect.tsx`](apps/web/components/onboarding-redirect.tsx) - Line 26: Add null check for `onboardingComplete`

---

### Step 4: Remove Unused Organization Plugin

Since you don't plan to use organizations, remove the plugin to eliminate ~10 type errors.**Update:** [`packages/auth/auth.ts`](packages/auth/auth.ts)Remove from imports (line 21):

```typescript
// Remove: organization,
```

Remove from plugins array (lines 327-352):

```typescript
// Remove entire organization({ ... }) block
```

**Update:** [`packages/auth/client.ts`](packages/auth/client.ts)Remove from imports (line 5):

```typescript
// Remove: organizationClient,
```

Remove from plugins array (line 17):

```typescript
// Remove: organizationClient(),
```

This will also remove errors in [`apps/web/modules/saas/auth/lib/server.ts`](apps/web/modules/saas/auth/lib/server.ts) where organization methods are called.---

### Step 5: Fix String Union Type Issues

Handle form inputs that return generic `string` but need to be assigned to union types.**Update:** [`apps/web/modules/saas/admin/component/announcements/CreateAnnouncementDialog.tsx`](apps/web/modules/saas/admin/component/announcements/CreateAnnouncementDialog.tsx)Add type assertions where form data is used:

```typescript
// Lines 54-55: Add type assertions
type: formData.type as Announcement["type"],
priority: formData.priority as Announcement["priority"],

// Lines 112, 123: Add fallbacks for icon/color lookups
const Icon = typeIcons[type as keyof typeof typeIcons] || Info;
const color = typeColors[type as keyof typeof typeColors] || "blue";
```

**Keep:** [`packages/api/modules/admin/types.ts`](packages/api/modules/admin/types.ts)The `type: string` and `priority: string` changes should remain (lines 120-121) since the database schema uses `String` not enums, and this matches the actual data structure.---

### Step 6: Fix Beta Feature Hook

Remove unnecessary type assertions now that proper types are defined.**Update:** [`apps/web/lib/hooks/use-beta-feature.ts`](apps/web/lib/hooks/use-beta-feature.ts)Line 14: Change from:

```typescript
const betaFeatures = (user.betaFeatures as string[]) || [];
```

To:

```typescript
const betaFeatures = user.betaFeatures ?? [];
```

Line 27: Same change.---

### Step 7: Fix Affiliate Dashboard Null Checks

Add null safety for affiliate data that might be undefined.**Update:** [`apps/web/modules/saas/affiliate/components/affiliate-dashboard.tsx`](apps/web/modules/saas/affiliate/components/affiliate-dashboard.tsx)Lines 37-40, 92-93: Add null checks:

```typescript
// Line 37-40: Add optional chaining
const totalReferrals = status.affiliate?.totalReferrals ?? 0;
const totalEarnings = status.affiliate?.totalEarnings ?? 0;
const payoutEmail = status.affiliate?.payoutEmail ?? user?.email ?? "";

// Lines 92-93: Add null defaults
earningsBreakdown={earningsBreakdown ?? { monthly: 0, annual: 0, total: 0 }}
referralPipeline={referralPipeline ?? { pending: 0, converted: 0, total: 0 }}
```

---

### Step 8: Fix Admin User Dialog

Fix property name mismatch in add user dialog.**Update:** [`apps/web/modules/saas/admin/component/users/AddUserDialog.tsx`](apps/web/modules/saas/admin/component/users/AddUserDialog.tsx)Line 80: Change from:

```typescript
userId: result.userId,
```

To:

```typescript
userId: result.user.id,
```

The API returns `{ success: boolean; user: { id, email, name, role } }`, not a `userId` field.---

### Step 9: Fix Onboarding API Type

Add missing field to user type definition.**Update:** [`apps/web/lib/onboarding-api.ts`](apps/web/lib/onboarding-api.ts)Line 20: The `onboardingComplete` field should be recognized via `authClient.updateUser()` since it's in `additionalFields`. If error persists, add explicit type:

```typescript
await authClient.updateUser({
  onboardingComplete: true,
} as Parameters<typeof authClient.updateUser>[0]);
```

---

### Step 10: Run Incremental Builds

After each fix, run `pnpm build` to reveal the next error. Continue fixing errors one by one until the build passes.**Testing strategy:**

1. Apply Step 1-2 fixes
2. Run `pnpm build` - should get past notifications page error
3. Apply Step 3 fixes (null safety)
4. Run `pnpm build` - should eliminate ~10 errors
5. Apply Step 4 fixes (remove organization)
6. Run `pnpm build` - should eliminate ~10 more errors
7. Continue through remaining steps
8. Final `pnpm build` should pass with 0 errors

---

## Verification Checklist

After all fixes:

- [ ] Run `pnpm build` - completes without errors
- [ ] Run `pnpm tsc --noEmit` - 0 errors
- [ ] Test dev-login still works
- [ ] Test admin dashboard loads
- [ ] Test notifications page loads
- [ ] Test affiliate dashboard (both simple and full versions)
- [ ] Test onboarding flow
- [ ] Verify session data includes all custom fields

---

## Why This Follows Better-Auth Patterns

1. **Type Inference First**: We keep `inferAdditionalFields<typeof auth>()` in the client
2. **Explicit Augmentation**: Add `types.ts` for strict TypeScript mode (common pattern in production apps)