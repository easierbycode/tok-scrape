---
name: Add Post-Purchase Scenario
overview: Add a new dev scenario "user-post-purchase" that simulates a user who just completed a Stripe purchase and needs to complete onboarding (with active subscription), and fix the server-side onboarding check to work with client-side localStorage scenarios.
todos:
  - id: add-mock-api-scenario
    content: Add user-post-purchase scenario to mockGetUser, mockGetSubscriptionStatus, and mockGetAffiliate in mock-api.ts
    status: completed
  - id: update-dev-login
    content: Update dev-login page with new button and createMockUser logic
    status: completed
  - id: update-dev-tools
    content: Update dev-tools-panel with new scenario and createMockUser logic
    status: completed
  - id: fix-server-check
    content: Comment out server-side onboarding check in app layout
    status: completed
  - id: test-scenario
    content: Test new post-purchase scenario triggers onboarding correctly
    status: completed
---

# Add Post-Purchase Dev Scenario for Onboarding Testing

## Problem Statement

Currently, the "user-first-login" scenario has no subscription (triggers choose-plan redirect) and incorrectly suggests it triggers onboarding. We need a separate scenario for users who just purchased a subscription via Stripe and should go through onboarding.

Additionally, the server-side onboarding check in layout.tsx cannot read localStorage, causing scenarios to always default to "user-affiliate" on the server.

## Changes Required

### 1. Add New Scenario to Mock API

**File**: [`apps/web/lib/mock-api.ts`](apps/web/lib/mock-api.ts)

**In `mockGetUser()` function (around line 43)**, add the new scenario BEFORE "user-first-login":

```typescript
// Post-purchase user needs to complete onboarding (HAS subscription)
if (scenario === "user-post-purchase") {
  return {
    ...mockUser,
    onboardingComplete: false,
    discordConnected: false,
    discordId: null,
    role: null,
  };
}
```

**In `mockGetSubscriptionStatus()` function (around line 72)**, add to switch statement:

```typescript
case "user-post-purchase":
  return mockSubscriptionStates.active;
```

**In `mockGetAffiliate()` function (around line 145)**, add to null check:

```typescript
if (scenario === "user-no-affiliate" || scenario === "user-no-subscription" || 
    scenario === "user-first-login" || scenario === "user-post-purchase") {
  return null;
}
```

### 2. Update Dev Login Page

**File**: [`apps/web/app/auth/dev-login/page.tsx`](apps/web/app/auth/dev-login/page.tsx)

**Update `createMockUser()` function (line 9)**:

```typescript
const createMockUser = (scenario: string) => {
  const isAdmin = scenario === "admin";
  const isPostPurchase = scenario === "user-post-purchase";
  const isFirstLogin = scenario === "user-first-login";
  
  return {
    id: `${scenario}-123`,
    email: isAdmin ? "kyle@lifepreneur.com" : "user@lifepreneur.com",
    name: isAdmin ? "Kyle (Admin)" : "Demo User",
    role: isAdmin ? "admin" : null,
    image: null,
    emailVerified: true,
    onboardingComplete: !(isFirstLogin || isPostPurchase),
  };
};
```

**Add new button in the buttons section (after line 47)**, and update "user-first-login" description:

```typescript
<Button onClick={() => handleLogin("user-post-purchase")} className="w-full" variant="outline">
  🎉 New Subscriber (Post-Purchase)
  <span className="ml-2 text-xs text-muted-foreground">(Triggers onboarding + has subscription)</span>
</Button>

<Button onClick={() => handleLogin("user-first-login")} className="w-full" variant="outline">
  🚫 New User (No Subscription)
  <span className="ml-2 text-xs text-muted-foreground">(Tests subscription redirect)</span>
</Button>
```

### 3. Update Dev Tools Panel

**File**: [`apps/web/components/dev-tools-panel.tsx`](apps/web/components/dev-tools-panel.tsx)

**Update `createMockUser()` function (line 20)**:

```typescript
const createMockUser = (scenario: string) => {
  const isAdmin = scenario === "admin";
  const isPostPurchase = scenario === "user-post-purchase";
  const isFirstLogin = scenario === "user-first-login";

  return {
    id: `${scenario}-123`,
    email: isAdmin ? "kyle@lifepreneur.com" : "user@lifepreneur.com",
    name: isAdmin ? "Kyle (Admin)" : "Demo User",
    role: isAdmin ? "admin" : null,
    image: null,
    emailVerified: true,
    onboardingComplete: !(isFirstLogin || isPostPurchase),
  };
};
```

**Update scenarios array (line 35)**, add new scenario at top:

```typescript
const scenarios = [
  { id: "user-post-purchase", label: "🎉 Post-Purchase (Onboarding)" },
  { id: "user-first-login", label: "🆕 New User (First Login)" },
  // ... rest of scenarios
];
```

### 4. Fix Server-Side Onboarding Check

**File**: [`apps/web/app/(saas)/app/layout.tsx`](apps/web/app/\(saas)/app/layout.tsx)

**Comment out the server-side mock check (lines 31-38)** since it cannot read localStorage and defaults to wrong scenario:

```typescript
// 🔧 MOCK ONBOARDING CHECK - DISABLED FOR CLIENT-SIDE HANDLING
// Server cannot read localStorage scenarios, so we rely on the client-side
// OnboardingRedirect component below which properly reads dev-scenario
/*
const mockUser = await mockGetUser();

if (!mockUser.onboardingComplete) {
  redirect("/onboarding?step=1");
}
*/
```

The existing `OnboardingRedirect` component on line 94 will handle the redirect on the client side where localStorage is accessible.

## Testing Steps

1. Navigate to `/auth/dev-login`
2. Click "New Subscriber (Post-Purchase)" button
3. Should redirect to `/app/content`, then immediately redirect to `/onboarding?step=1`
4. Complete onboarding flow (3 steps)
5. Should redirect to dashboard after completion
6. Verify "New User (No Subscription)" still triggers choose-plan redirect, not onboarding

## Result

- New "user-post-purchase" scenario properly simulates Stripe success flow
- Has active subscription (no choose-plan redirect)
- Has onboardingComplete: false (triggers onboarding)
- "user-first-login" clarified as subscription testing scenario only
- Server-side check disabled in favor of working client-side redirect