---
name: Pre-Phase 1 Setup
overview: Set up development environment with Discord/Stripe external services, seed test users, modify dev-login to use real Better-Auth authentication, and remove mock session code from the frontend.
todos:
  - id: external-setup
    content: Set up Discord app, bot, roles, and Stripe products (manual)
    status: completed
  - id: env-vars
    content: Add all required environment variables to .env.local
    status: completed
    dependencies:
      - external-setup
  - id: seed-script
    content: Create scripts/seed-test-users.ts for test user seeding
    status: completed
  - id: dev-login
    content: Modify dev-login page to use real Better-Auth authentication
    status: completed
  - id: remove-mock
    content: Remove mock session code from NavBar.tsx and UserMenu.tsx
    status: completed
  - id: validation-scripts
    content: Create validate-env.ts and test-stripe.ts scripts
    status: completed
  - id: test-flow
    content: Run seeds, validation, and test dev-login flow end-to-end
    status: completed
    dependencies:
      - env-vars
      - seed-script
      - dev-login
      - remove-mock
      - validation-scripts
---

# Pre-Phase 1: Development Environment Setup

**Duration:** 1-2 hours**Dependencies:** None**Goal:** Prepare environment, create external services, seed test data, transition to real Better-Auth---

## Current State Analysis

The codebase currently has:

- **Dev-login** ([`apps/web/app/auth/dev-login/page.tsx`](apps/web/app/auth/dev-login/page.tsx)): Uses localStorage mocks
- **NavBar/UserMenu** have dev session handling via `localStorage.getItem("dev-mock-session")`
- **Better-Auth client** exists at [`packages/auth/client.ts`](packages/auth/client.ts) with `signIn.email()` 
- **ORPC procedures** have dev mode bypasses (kept until Phase 1)
- **No scripts directory** - needs creation

---

## Part A: External Services Setup (Manual - 30 min)

### A1. Database Backup

Since you're likely using Supabase (hosted PostgreSQL), use the Supabase Dashboard:

1. Go to Project Settings > Database > Backups
2. Create a manual backup
3. OR use `pg_dump` if you have psql installed locally

### A2. Discord Application Setup

1. Go to https://discord.com/developers/applications
2. Create app "LifePreneur Bot"
3. Get OAuth credentials (OAuth2 > General)
4. Create Bot user (Bot tab > Add Bot)
5. Enable Gateway Intents: SERVER MEMBERS INTENT
6. Invite bot to test server with permissions: Manage Roles, View Channels, Send Messages
7. Create roles in Discord: "Active Member" (green), "Grace Period" (orange)
8. Copy all IDs (enable Developer Mode in Discord settings)

### A3. Stripe Products Setup

1. Stripe Dashboard > Products > Add Product
2. Name: "LifePreneur Membership"
3. Add Monthly price: $99/month
4. Add Annual price: $999/year
5. Configure webhook endpoint with events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.*`

---

## Part B: Environment Variables

Add to `.env.local`:

```bash
# Discord OAuth
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Discord Bot
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_ACTIVE_ROLE_ID=...
DISCORD_GRACE_PERIOD_ROLE_ID=...

# Stripe Products (get from Stripe Dashboard)
STRIPE_PRODUCT_ID=prod_...
STRIPE_DEFAULT_PRICE_ID=price_...

# Security
CSRF_SECRET=<generate-64-char-hex>

# Admin
DEV_ADMIN_BYPASS=true
SUPER_ADMIN_EMAILS=kyle@lifepreneur.com
```

Generate CSRF secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Part C: Code Implementation (30-45 min)

### C1. Create Scripts Directory and Seed Test Users

Create `scripts/seed-test-users.ts` to seed 5 test users with password "test-password-123":

- test-newsubscriber@lifepreneur.com (onboarding incomplete)
- test-affiliate@lifepreneur.com
- test-nosubscription@lifepreneur.com
- test-graceperiod@lifepreneur.com
- test-admin@lifepreneur.com (role: "admin")

Key considerations:

- Use Better-Auth's password hashing (verify if `@node-rs/argon2` is installed)
- Create both User and Account records (Better-Auth requirement)
- Script should be idempotent (skip existing users)

### C2. Modify Dev-Login Page

Replace [`apps/web/app/auth/dev-login/page.tsx`](apps/web/app/auth/dev-login/page.tsx) to:

- Use real `authClient.signIn.email()` instead of localStorage
- Keep the same scenario UI buttons
- Add production guard (`throw` in production)
- Redirect admin to `/admin`, others to `/app/content`

### C3. Remove Mock Session from Components

Update these files to remove localStorage dev session logic:

1. **[`apps/web/modules/saas/shared/components/NavBar.tsx`](apps/web/modules/saas/shared/components/NavBar.tsx)**

- Remove lines 33-48 (devUser state and useEffect)
- Change `currentUser` to just use `user` from `useSession()`
- Update isAdmin check

2. **[`apps/web/modules/saas/shared/components/UserMenu.tsx`](apps/web/modules/saas/shared/components/UserMenu.tsx)**

- Remove lines 43-57 (devUser state and useEffect)
- Change `currentUser` to just use `user` from `useSession()`

### C4. Create Environment Validation Script

Create `scripts/validate-env.ts` to check all required variables:

- DATABASE_URL, DIRECT_URL
- Stripe keys and product IDs
- Better-Auth secrets
- Discord credentials
- CSRF_SECRET (validate 64+ chars)

### C5. Create Stripe Connection Test

Create `scripts/test-stripe.ts` to verify Stripe API connectivity.---

## Part D: Validation and Testing (15 min)

### D1. Run Validation Script

```bash
pnpm tsx scripts/validate-env.ts
```



### D2. Run Seed Script

```bash
pnpm tsx scripts/seed-test-users.ts
```



### D3. Verify in Prisma Studio

```bash
pnpm prisma studio
```

Check: 5 test users created with accounts

### D4. Test Dev-Login Flow

1. Start dev server: `pnpm dev`
2. Navigate to `/auth/dev-login`
3. Click "Test Admin" - should log in via Better-Auth
4. Verify real session (not localStorage)

---

## Success Criteria

- [ ] Database backed up
- [ ] Discord bot invited to server and roles created
- [ ] Stripe product with 2 prices created
- [ ] All environment variables in `.env.local`
- [ ] CSRF secret is 64+ characters
- [ ] 5 test users seeded (can login with "test-password-123")
- [ ] Dev-login uses real Better-Auth (no localStorage)
- [ ] NavBar/UserMenu use only Better-Auth session