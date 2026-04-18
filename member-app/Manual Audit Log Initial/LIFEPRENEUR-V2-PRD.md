# LIFEPRENEUR V2 - PRODUCT REQUIREMENTS DOCUMENT

**Version:** 2.0
**Updated:** December 2, 2025
**Change Reason:** Aligned with Supastarter's actual architecture (Prisma ORM, Purchase table pattern)
**Previous Version:** V1 (Original PRD)

---

## WHAT CHANGED FROM V1

> **Key Discovery:** Supastarter uses Prisma ORM and a `Purchase` table for subscription management, not direct Supabase queries with `subscription_status` on the User model.

| V1 Said | V2 Reality |
|---------|------------|
| Direct Supabase queries | Prisma ORM (talks to Supabase) |
| `users.subscription_status` field | `Purchase` table with `status` field |
| `users.subscription_override` field | Create Purchase record with no Stripe ID |
| Separate `subscriptions` table | Use existing `Purchase` table |
| `users.grace_period_ends_at` | `Purchase.currentPeriodEnd` + status |

**User experience stays identical. Only implementation details changed.**

---

## PROJECT OVERVIEW

**Product:** Lifepreneur - Membership platform for TikTok Shop education with community and affiliate features
**Timeline:** 4 weeks to alpha (Week 5 stress test, January public launch)
**Builder:** Kyle (solo dev with AI tools)
**Status:** Rebuilding from scratch after beta security failures

### Critical Success Factors
1. **Zero unauthorized content access** - No account creation without purchase (unless admin override)
2. **Self-service Discord integration** - No manual support intervention needed
3. **Bulletproof subscription gating** - RLS + middleware prevents all bypass attempts

### What Worked in Beta (Keep)
- Stripe payment processing and webhooks
- Rewardful affiliate attribution
- Basic Discord OAuth flow (needs error handling improvements)

### What Failed in Beta (Fix)
- Anyone could create accounts without purchasing
- Discord connection required manual support (5+ hours wasted)
- No proper access control on paid content routes
- Admin dashboard didn't exist at launch (manual backfill nightmare)

---

## TECHNICAL FOUNDATION

### Tech Stack
- **Frontend:** Next.js 15 (App Router), Tailwind v4
- **Backend:** Supabase (auth, database, RLS)
- **ORM:** Prisma (Supastarter's database access layer) ← **NEW**
- **Payments:** Stripe (existing integration)
- **Affiliates:** Rewardful (existing integration)
- **Email:** Resend
- **Hosting:** Vercel
- **Foundation:** Supastarter Next.js template ($244 with BLACK30 code)

### Why Supastarter?
Purchasing the template saves 5-7 days on:
- Battle-tested authentication patterns
- Prisma ORM with TypeScript safety
- Stripe subscription webhook handlers (Purchase table)
- Route protection middleware (proxy.ts pattern)
- Admin role-based access patterns

**Not using it for:** UI/design (replacing with v0 components), their feature set (customizing heavily)

### Supastarter Architecture Notes

**Database Access:**
```typescript
// Supastarter uses Prisma, not direct Supabase queries
import { db } from "@repo/database";

// Query users
const user = await db.user.findUnique({ where: { id: userId } });

// Query purchases (subscriptions)
const purchases = await db.purchase.findMany({ where: { userId } });
```

**Subscription Checking:**
```typescript
// Supastarter pattern for checking subscription
import { getPurchasesByUserId } from "@repo/database";
import { createPurchasesHelper } from "@repo/payments/lib/helper";

const purchases = await getPurchasesByUserId(userId);
const { activePlan } = createPurchasesHelper(purchases);

const hasAccess = activePlan?.status === 'active' || activePlan?.status === 'grace_period';
```

### Development Optimization Tools
- **v0.dev** - UI component generation
- **Claude** - Feature implementation (new chat per phase)
- **Supastarter components** - Auth forms, dashboard layouts
- **Competitor screenshots** - Feed to Claude for recreation

---

## USER ROLES & ACCESS MATRIX

| Role | Authentication | Can Access | Cannot Access |
|------|---------------|-----------|---------------|
| **Public Visitor** | None | Landing pages, pricing, public resources | Everything else |
| **Logged In (No Sub)** | Authenticated | Account settings, billing/upgrade page | All paid features |
| **Active Subscriber** | Authenticated + Active Purchase | Content library, Discord, affiliate tools, community | Admin functions |
| **Admin** | Authenticated + Admin role | Content publishing, analytics, user management | Super admin functions |
| **Super Admin** | Authenticated + Super admin role | Everything including breaking changes | Nothing |

### Special Cases
- **Admin-created accounts:** Create Purchase record with `productId = 'manual-override'` and no Stripe IDs
- **Grace period users:** Keep access when `Purchase.status = 'grace_period'`
- **Cancelled subscribers:** Lose access when `Purchase.status = 'cancelled'`, Discord role changes to "Support Only"

---

## DATABASE SCHEMA

### Existing Supastarter Tables (Don't Modify)

```typescript
// User model - managed by Supastarter auth
// Located in packages/database/prisma/schema.prisma
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerified     DateTime?
  name              String?
  avatarUrl         String?
  // ... other Supastarter fields
  
  // EXTEND with these fields:
  discordId         String?   @map("discord_id")
  discordConnected  Boolean   @default(false) @map("discord_connected")
  
  purchases         Purchase[]
  // ... relations
}

// Purchase model - Supastarter's subscription system
// This replaces V1's "subscriptions" table
model Purchase {
  id                   String    @id @default(cuid())
  userId               String?   @map("user_id")
  organizationId       String?   @map("organization_id")
  productId            String    @map("product_id")
  variantId            String    @map("variant_id")
  status               String    // 'active', 'grace_period', 'cancelled', 'paused'
  stripeSubscriptionId String?   @unique @map("stripe_subscription_id")
  stripeCustomerId     String?   @map("stripe_customer_id")
  currentPeriodEnd     DateTime? @map("current_period_end")
  cancelAtPeriodEnd    Boolean   @default(false) @map("cancel_at_period_end")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  
  user                 User?     @relation(fields: [userId], references: [id])
  // ... other relations
}
```

### Custom Tables to Add

```sql
-- Content videos table (ADD THIS via Prisma migration)
CREATE TABLE content_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT NOT NULL,
  is_mock BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL,
  duration INTEGER,
  published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Affiliates table (ADD THIS)
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  rewardful_affiliate_id TEXT UNIQUE NOT NULL,
  custom_link_slug TEXT UNIQUE,
  total_referrals INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  payout_method TEXT DEFAULT 'paypal',
  payout_email TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Admin users table (ADD THIS)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'content_publisher'
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id)
);

-- Video progress tracking (OPTIONAL - nice to have for v1)
CREATE TABLE video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES content_videos(id) ON DELETE CASCADE,
  progress_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  last_watched_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, video_id)
);
```

### Prisma Schema Additions

```prisma
// Add to packages/database/prisma/schema.prisma

model ContentVideo {
  id           String   @id @default(cuid())
  title        String
  description  String?
  videoUrl     String   @map("video_url")
  thumbnailUrl String?  @map("thumbnail_url")
  category     String
  isMock       Boolean  @default(false) @map("is_mock")
  orderIndex   Int      @map("order_index")
  duration     Int?
  published    Boolean  @default(false)
  viewCount    Int      @default(0) @map("view_count")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  progress     VideoProgress[]

  @@map("content_videos")
}

model Affiliate {
  id                  String   @id @default(cuid())
  userId              String   @map("user_id")
  rewardfulAffiliateId String  @unique @map("rewardful_affiliate_id")
  customLinkSlug      String?  @unique @map("custom_link_slug")
  totalReferrals      Int      @default(0) @map("total_referrals")
  totalEarnings       Decimal  @default(0) @db.Decimal(10, 2) @map("total_earnings")
  payoutMethod        String   @default("paypal") @map("payout_method")
  payoutEmail         String?  @map("payout_email")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  user                User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("affiliates")
}

model AdminUser {
  id        String   @id @default(cuid())
  userId    String   @unique @map("user_id")
  role      String   // 'super_admin', 'admin', 'content_publisher'
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("admin_users")
}

model VideoProgress {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  videoId         String   @map("video_id")
  progressSeconds Int      @default(0) @map("progress_seconds")
  completed       Boolean  @default(false)
  lastWatchedAt   DateTime @default(now()) @map("last_watched_at")

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  video           ContentVideo @relation(fields: [videoId], references: [id], onDelete: Cascade)

  @@unique([userId, videoId])
  @@map("video_progress")
}
```

### Row-Level Security Policies

```sql
-- Content only accessible with active Purchase
CREATE POLICY "Content requires active subscription" ON content_videos
  FOR SELECT USING (
    published = true AND (
      EXISTS (
        SELECT 1 FROM "Purchase"
        WHERE "Purchase"."user_id" = auth.uid()::text
        AND "Purchase".status IN ('active', 'grace_period')
      )
    )
  );

-- Affiliates table only for subscribers
CREATE POLICY "Affiliates require subscription" ON affiliates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "Purchase"
      WHERE "Purchase"."user_id" = auth.uid()::text
      AND "Purchase".status IN ('active', 'grace_period')
    )
  );

-- Admin users table only for admins
CREATE POLICY "Admin table for admins only" ON admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()::text
    )
  );

-- Content management for admin roles only
CREATE POLICY "Content management for admins" ON content_videos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()::text
      AND admin_users.role IN ('super_admin', 'admin', 'content_publisher')
    )
  );
```

---

## SUBSCRIPTION STATUS MAPPING

| Your Concept | Supastarter Implementation |
|--------------|---------------------------|
| User has active subscription | `Purchase.status === 'active'` |
| User in grace period | `Purchase.status === 'grace_period'` |
| User cancelled | `Purchase.status === 'cancelled'` |
| User never subscribed | No Purchase record for user |
| Admin override (free access) | Purchase with `productId = 'manual-override'`, no Stripe IDs |

### Helper Function Pattern

```typescript
// Create a helper for subscription checking
// apps/web/lib/subscription.ts

import { getPurchasesByUserId } from "@repo/database";
import { createPurchasesHelper } from "@repo/payments/lib/helper";

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const purchases = await getPurchasesByUserId(userId);
  const { activePlan } = createPurchasesHelper(purchases);
  
  return activePlan?.status === 'active' || activePlan?.status === 'grace_period';
}

export async function getSubscriptionStatus(userId: string) {
  const purchases = await getPurchasesByUserId(userId);
  const { activePlan } = createPurchasesHelper(purchases);
  
  if (!activePlan) return 'none';
  return activePlan.status; // 'active', 'grace_period', 'cancelled', 'paused'
}

export async function isInGracePeriod(userId: string): Promise<boolean> {
  const purchases = await getPurchasesByUserId(userId);
  const { activePlan } = createPurchasesHelper(purchases);
  
  return activePlan?.status === 'grace_period';
}
```

---

## CRITICAL USER FLOWS

### 1. Purchase → Account Creation → Onboarding

```
User Journey:
1. User lands on pricing page (public)
2. Clicks "Subscribe Now" ($99/mo or $1000/yr)
3. Redirects to Stripe Checkout (collects email, payment)
4. Payment succeeds → Stripe webhook fires
5. Webhook creates User record in Prisma (if doesn't exist)
6. Webhook creates Purchase record with status = 'active'
7. Webhook sends magic link email via Resend
8. User clicks magic link → sets password
9. Lands on 3-step onboarding flow:
   - Step 1: Complete profile (name, avatar optional)
   - Step 2: Connect Discord (skippable, can retry later)
   - Step 3: Success screen with dashboard overview
10. Redirects to /app/content
```

**Edge Cases:**
- If webhook delayed: show "Processing your subscription" screen
- If user already exists (edge case): create new Purchase linked to existing account
- If Discord OAuth fails: allow skip, show persistent banner to retry

### 2. Discord Connection Flow

```
Happy Path:
1. User clicks "Connect Discord" (onboarding or dashboard banner)
2. Redirects to Discord OAuth consent screen
3. User authorizes
4. Discord redirects back with authorization code
5. Exchange code for access token
6. Fetch Discord user ID from API
7. Use bot token to add user to server with "Member" role
8. Update User record: discordId = <id>, discordConnected = true
9. Show success message

Error Handling:
- OAuth timeout: "Connection failed, please try again"
- No Discord account: Link to "Create Discord Account" tutorial
- Already in server: Just sync role, show "Already connected"
- Server full: Notify admin, show "Contact support" message
- Invalid permissions: Check bot has "Manage Roles" permission

Retry Logic:
- User can retry from dashboard anytime
- No support intervention needed
- Clear error messages guide user to fix issues
```

### 3. Subscription Lifecycle

```
Active Subscription:
- Purchase.status = 'active'
- Full platform access
- Discord "Member" role active
- Can generate affiliate links

Payment Failure:
1. Stripe webhook: invoice.payment_failed
2. Update Purchase.status = 'grace_period'
3. Update Purchase.currentPeriodEnd = now() + 3 days
4. Send "Payment Failed" email via Resend
5. Show banner in dashboard: "Update payment method"
6. User retains access for 3 days

Grace Period Expiration:
1. Cron job runs daily (Vercel cron)
2. Finds Purchases where status = 'grace_period' AND currentPeriodEnd < now()
3. Updates Purchase.status = 'cancelled'
4. Triggers Discord role change (Member → Support Only)
5. Sends "Subscription Cancelled" email
6. User redirected to upgrade page on next login

Renewal Success:
1. Stripe webhook: invoice.payment_succeeded
2. If status was 'grace_period', update to 'active'
3. Update currentPeriodEnd to new date
4. Send "Renewal Successful" email
```

### 4. Admin Account Creation (Manual Override)

```
Super Admin Flow:
1. Super admin goes to /admin/users
2. Clicks "Create Manual Account"
3. Form: email, name, set_password checkbox
4. If set_password = true: include password field
5. Toggle "Grant Free Access" (creates override Purchase)
6. Submit → creates User in Prisma
7. If free access toggled, creates Purchase record:
   {
     userId: newUser.id,
     productId: 'manual-override',
     variantId: 'admin-granted',
     status: 'active',
     stripeSubscriptionId: null,
     stripeCustomerId: null,
     currentPeriodEnd: null, // Never expires
     cancelAtPeriodEnd: false
   }
8. Sends welcome email with credentials
9. User can login and access platform without payment
10. Does NOT automatically get Discord role (must connect manually)

Use Cases:
- Comp accounts for partners/press
- Team member access
- VIP exceptions
```

---

## 4-WEEK BUILD PLAN

### WEEK 1: FOUNDATION

**Day 1: Supastarter Setup** ✅ COMPLETED
- [x] Purchase Supastarter with BLACK30 code ($244.30)
- [x] Clone repository locally
- [x] Deploy demo version to Vercel (test deployment pipeline)
- [x] Review documentation at https://supastarter.dev/docs/nextjs

**Day 2: Codebase Audit** ✅ COMPLETED
Critical files studied:
- `apps/web/lib/proxy.ts` - Route protection patterns (not middleware.ts)
- `packages/payments/` - Stripe webhook handling
- `packages/database/` - Prisma schema and helpers
- `apps/web/app/(auth)/` - Authentication flows
- `apps/web/app/app/` - Dashboard structure

Visual rebrand completed:
- [x] Replace Supastarter → LifePreneur text
- [x] Update logo and favicon
- [x] Apply brand colors (#dd6220 primary)

**Day 3-4: Database Schema Implementation**
- [ ] Extend Prisma schema with custom models (ContentVideo, Affiliate, AdminUser)
- [ ] Add discordId and discordConnected to User model
- [ ] Run Prisma migrations
- [ ] Implement RLS policies on Supabase for custom tables
- [ ] Add 10 mock videos for UI development
- [ ] Test subscription checking with Purchase table

Claude Prompt:
```
I'm extending Supastarter's Prisma schema for a membership platform. 
Supastarter already has User and Purchase models.

Help me add these models to schema.prisma:
- ContentVideo (video library)
- Affiliate (Rewardful integration)
- AdminUser (role-based access)
- VideoProgress (optional)

Also show me how to extend the User model with discordId and discordConnected fields.

Current Purchase model handles subscriptions with status field ('active', 'grace_period', 'cancelled').
```

**Day 5: Stripe Webhook Extension**
- [ ] Review existing Supastarter webhook handlers in packages/payments/
- [ ] Add grace period handling (update Purchase.status and currentPeriodEnd)
- [ ] Add magic link email trigger on checkout.session.completed
- [ ] Test webhook locally with Stripe CLI
- [ ] Deploy and update webhook URL in Stripe dashboard

Events to handle (extend existing handlers):
- `checkout.session.completed` → create Purchase with status='active', send magic link
- `customer.subscription.updated` → sync Purchase.status changes
- `customer.subscription.deleted` → set Purchase.status='cancelled'
- `invoice.payment_failed` → set Purchase.status='grace_period', set currentPeriodEnd
- `invoice.payment_succeeded` → if grace_period, set back to 'active'

---

### WEEK 2: AUTH & CORE UI

**Day 6-7: Purchase-First Auth Flow**
- [ ] Customize Stripe checkout to collect email
- [ ] Extend webhook to create User record on purchase (if not exists)
- [ ] Send magic link email via Resend after Purchase created
- [ ] Build password setup page
- [ ] Test end-to-end: purchase → account → login

Claude Prompt:
```
I'm using Supastarter with Prisma. Extend the checkout.session.completed webhook to:
1. Create User record if email doesn't exist
2. Create Purchase record with status='active'
3. Send magic link email via Resend

Supastarter patterns:
- Use @repo/database for Prisma queries
- Use getPurchasesByUserId and createPurchasesHelper for subscription checks
- Purchase table has: userId, productId, variantId, status, stripeSubscriptionId, etc.
```

**Day 8: Onboarding Flow**
Build 3-step onboarding with v0:
- [ ] Step 1: Profile completion (name, avatar upload optional)
- [ ] Step 2: Discord connection (with skip option)
- [ ] Step 3: Success screen with dashboard preview

Design in v0, then:
```
Take this v0 component and integrate it with Next.js 15 App Router. 
User data should save via Prisma (use db.user.update).
Include form validation and loading states.
```

**Day 9-10: Discord OAuth Integration**
- [ ] Set up Discord application at discord.com/developers
- [ ] Create OAuth redirect route in Next.js
- [ ] Exchange code for access token
- [ ] Fetch Discord user data
- [ ] Use bot to add user to server with "Member" role
- [ ] Update User: discordId and discordConnected via Prisma
- [ ] Build retry functionality if OAuth fails

Claude Prompt:
```
Implement Discord OAuth in Next.js 15 with Prisma. After user authorizes:
1) Get their Discord ID
2) Add them to my server using bot token
3) Assign "Member" role
4) Update User record via Prisma: discordId = <id>, discordConnected = true

Show me the OAuth callback route and Discord API calls.
```

**Day 11: Route Protection**
- [ ] Study Supastarter's proxy.ts pattern
- [ ] Add subscription checks for paid routes using Purchase table
- [ ] Test access control: try accessing /app/content without active Purchase
- [ ] Add grace period logic to route protection
- [ ] Build "Upgrade Required" page

Route protection logic:
```typescript
// In page or layout server component
import { hasActiveSubscription } from "@/lib/subscription";

export default async function ProtectedPage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    redirect('/login');
  }
  
  const hasAccess = await hasActiveSubscription(session.user.id);
  
  if (!hasAccess) {
    redirect('/app/upgrade');
  }
  
  // Render protected content
}
```

---

### WEEK 3: FEATURES

**Day 12-14: Content Library (Netflix-Style)**

Build with v0:
- [ ] Search v0 community for "Netflix layout" or "video grid"
- [ ] Customize for your brand
- [ ] Export components

Features to implement:
- [ ] Video grid layout with thumbnails
- [ ] Video detail page with embedded player (Vimeo/Wistia)
- [ ] Category filtering
- [ ] "MOCK EXAMPLE" badges on mock videos
- [ ] "Coming Soon" sections for future categories (YouTube, Instagram)
- [ ] Next video button
- [ ] Progress tracking (optional for v1)

Claude Prompt:
```
Build a Netflix-style video library in Next.js 15 with Prisma. 

Data layer:
- Fetch from ContentVideo model via Prisma
- Only show where published = true
- Route protection checks Purchase.status = 'active' or 'grace_period'

UI:
- Grid layout with cards: thumbnail, title, duration, "MOCK" badge if isMock=true
- Click card → video player page
- Use Tailwind v4
```

Admin content management:
- [ ] Video upload form (title, description, URL, thumbnail, category, isMock)
- [ ] Video list table with edit/delete
- [ ] Publish/unpublish toggle
- [ ] Manual orderIndex setting

**Day 15-16: Affiliate Dashboard**

Design sections in v0:
- [ ] Overview cards (total referrals, earnings, CTR)
- [ ] Affiliate link generator
- [ ] Copy link button
- [ ] Earnings table with pagination
- [ ] Payout settings (PayPal email)

Rewardful integration:
- [ ] Connect to Rewardful API
- [ ] Sync affiliate data on user creation
- [ ] Daily cron job to update earnings
- [ ] Display real-time stats

Claude Prompt:
```
Build an affiliate dashboard in Next.js 15 with Prisma.

Data:
- Fetch from Affiliate model linked to current user
- Only accessible if Purchase.status = 'active' or 'grace_period'

UI:
- Total referrals, total earnings, affiliate link with copy button
- Earnings table with pagination
- Form to update payoutEmail
- Use Tailwind v4 with card-based layout
```

**Day 17: Admin Dashboard - User Management**
- [ ] User list table (search, filters)
- [ ] View user details modal (show Purchase status, Discord connection)
- [ ] Manual account creation form with "Grant Free Access" toggle
- [ ] Discord connection status viewer
- [ ] Delete user confirmation

Build the table in v0, then:
```
Convert this table to Next.js 15 with server-side pagination.

Fetch users via Prisma with their Purchase records.
Display: email, Purchase.status, discordConnected, createdAt.
Add search by email and filter by subscription status.

Admin check: Only allow if user has AdminUser record with role='super_admin'.
```

---

### WEEK 4: POLISH & DEPLOY

**Day 18-19: Email Templates (Resend)**

Create React Email templates:
1. **Welcome Email** - Trigger: account created
2. **Purchase Confirmation** - Trigger: checkout completed
3. **Renewal Reminder** - Trigger: 3 days before currentPeriodEnd (cron)
4. **Grace Period Warning** - Trigger: invoice.payment_failed
5. **Discord Reminder** - Trigger: 24hrs after signup if discordConnected=false (cron)

Claude Prompt:
```
Create 5 Resend email templates using React Email for Lifepreneur.

Templates needed:
1. Welcome - when User created
2. Purchase confirmation - when Purchase created with status='active'
3. Renewal reminder - 3 days before Purchase.currentPeriodEnd
4. Grace period warning - when Purchase.status changes to 'grace_period'
5. Discord reminder - 24hrs after User created if discordConnected=false

Use modern design with Tailwind. Show component code and trigger logic.
```

**Day 20: Error States & Edge Cases**
- [ ] Loading skeletons for all pages
- [ ] Error boundaries for API failures
- [ ] Empty states ("No videos yet", "No referrals")
- [ ] 404 and 500 error pages
- [ ] Toast notifications for success/error actions
- [ ] Maintenance mode toggle (environment variable)

Test scenarios:
- [ ] Stripe webhook delayed 30 seconds
- [ ] Discord OAuth timeout
- [ ] User tries subscribing twice (should link new Purchase to existing User)
- [ ] Admin accidentally locks themselves out
- [ ] Direct URL access to paid content without active Purchase

**Day 21: Final Deployment Checklist**

Pre-deploy:
- [ ] All environment variables in Vercel
- [ ] Prisma migrations applied to production Supabase
- [ ] Supabase RLS enabled on custom tables
- [ ] Stripe webhook pointed to production URL
- [ ] Discord OAuth redirect URLs updated for prod
- [ ] Resend domain verified and sending
- [ ] Rewardful API keys for production environment

Smoke tests on production:
- [ ] Purchase subscription → User + Purchase created → email received
- [ ] Login → onboarding → Discord connect → content access
- [ ] Generate affiliate link → make test purchase → commission tracked
- [ ] Admin creates manual account → user can login → has active Purchase
- [ ] Let payment fail → Purchase.status='grace_period' → access revoked after 3 days

Performance checks:
- [ ] Lighthouse score on key pages
- [ ] Mobile responsiveness
- [ ] Page load times under 2 seconds

---

## WEEK 5: ALPHA STRESS TEST

### Test Group Setup
Invite 10-15 users:
- Mix of power users who will actually use it
- Technical folks who will try to break it
- Non-technical users who need hand-holding

### Test Scenarios
Give specific tasks:
1. "Try to access content without paying"
2. "Disconnect and reconnect Discord 3 times"
3. "Generate an affiliate link and share it"
4. "Cancel subscription and verify you lose access"
5. "Use the platform exclusively on mobile for a day"

### Success Metrics
- **Zero support tickets for Discord connection**
- **Zero unauthorized content access**
- **All emails deliver within 1 minute**
- **No 500 errors in Vercel logs**
- **Affiliate links track 100% of referrals**

### Bug Triage
- **P0 (Fix immediately):** Security holes, payment failures, data loss
- **P1 (Fix before public launch):** UX blockers, error states, email delivery
- **P2 (Fix post-launch):** UI polish, performance, nice-to-haves

---

## SUPASTARTER SETUP GUIDE (UPDATED)

### Key Files to Study

**Authentication Logic:**
- `apps/web/app/(auth)/login/page.tsx` - Login form
- `apps/web/app/(auth)/signup/page.tsx` - Signup form (disable this)
- `apps/web/lib/proxy.ts` - Route protection patterns
- `packages/auth/` - Auth utilities

**Subscription Handling:**
- `packages/payments/` - Stripe webhook handlers
- `packages/payments/lib/helper.ts` - createPurchasesHelper function
- `packages/database/` - Prisma schema and getPurchasesByUserId

**Database Patterns:**
- `packages/database/prisma/schema.prisma` - Data models
- `packages/database/src/` - Query helpers
- Use `db` from `@repo/database` for all queries

### Files to Delete/Modify

**Delete these (not needed):**
- AI Chatbot feature (`/app/chatbot/`)
- Organizations feature (entire section)
- Demo blog/changelog pages
- Example landing pages you won't use

**Modify these:**
- `packages/database/prisma/schema.prisma` - Add custom models
- `packages/payments/` - Extend webhooks for grace period
- `apps/web/app/app/` - Replace with your dashboard structure

### Common Supastarter Patterns to Reuse

**Subscription Check in Server Component:**
```typescript
import { getSession } from "@repo/auth";
import { getPurchasesByUserId } from "@repo/database";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    redirect('/login');
  }
  
  const purchases = await getPurchasesByUserId(session.user.id);
  const { activePlan } = createPurchasesHelper(purchases);
  
  if (!activePlan || !['active', 'grace_period'].includes(activePlan.status)) {
    redirect('/app/upgrade');
  }
  
  // Your protected page content
}
```

**Creating Manual Override Purchase:**
```typescript
import { db } from "@repo/database";

async function createManualAccess(userId: string) {
  await db.purchase.create({
    data: {
      userId,
      productId: 'manual-override',
      variantId: 'admin-granted',
      status: 'active',
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      currentPeriodEnd: null, // Never expires
      cancelAtPeriodEnd: false,
    }
  });
}
```

**Updating Purchase Status:**
```typescript
import { db } from "@repo/database";

// Set to grace period
await db.purchase.update({
  where: { stripeSubscriptionId: subscriptionId },
  data: {
    status: 'grace_period',
    currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // +3 days
  }
});

// Cancel after grace period
await db.purchase.update({
  where: { id: purchaseId },
  data: { status: 'cancelled' }
});
```

---

## OPTIMIZATION STRATEGIES

### Time-Saving Principles

**1. Don't Fight Supastarter Patterns**
- Use Purchase table for subscriptions (don't create separate subscriptions table)
- Use Prisma queries (don't write raw SQL)
- Use their auth helpers (don't reinvent authentication)

**2. v0 for All UI**
- Never write UI from scratch
- Search v0 community for similar components first
- Feed competitor screenshots to Claude if v0 doesn't have it

**3. One Claude Chat Per Feature**
- Don't build everything in one context window
- Start fresh chat when switching features
- Always paste relevant PRD section for context

**4. Mock Data Immediately**
- Add 10 mock videos via Prisma on Day 3
- Create test affiliate accounts on Day 1
- Build UI against real data shapes

**5. Deploy Early, Deploy Often**
- Push to Vercel on Day 3
- Catch deployment issues early
- Test on production-like environment

### When Starting New Claude Chat

Template prompt:
```
I'm building [FEATURE] for Lifepreneur, a membership platform.

Tech stack: Next.js 15 App Router, Prisma ORM, Supabase, Tailwind v4

Supastarter context:
- Subscriptions managed via Purchase table with status field
- Use getPurchasesByUserId and createPurchasesHelper for subscription checks
- Use db from @repo/database for Prisma queries

Requirement: [paste relevant PRD section]

Database schema: [paste relevant models]

Build this feature step-by-step with:
1. File structure
2. Code implementation
3. Error handling
4. Testing approach
```

### Red Flags You're Off Track

Stop and reassess if:
- ❌ Spending >1 day on a single feature
- ❌ Building features not in PRD
- ❌ Trying to make things "perfect" instead of functional
- ❌ Not deploying for >3 days
- ❌ Adding features boss didn't ask for
- ❌ Fighting with Supastarter patterns (use Purchase table!)
- ❌ Writing raw SQL instead of Prisma queries
- ❌ Writing UI from scratch instead of using v0

### Daily Standups with Yourself

Each morning ask:
1. What did I complete yesterday?
2. What's blocking me today?
3. Am I on track for this week's phase?
4. Do I need to cut scope to hit timeline?

---

## ACCEPTANCE CRITERIA FOR ALPHA LAUNCH

### Must Work (Non-Negotiable)

✅ **Purchase creates account automatically**
- Stripe checkout → webhook → User + Purchase records created
- Email with magic link sent within 60 seconds
- User can set password and login immediately

✅ **No account creation without purchase**
- Signup page disabled/removed
- Only admin can create manual accounts (with override Purchase)
- All routes check Purchase.status

✅ **Content is completely inaccessible without subscription**
- RLS policies on custom tables check Purchase table
- Server components verify Purchase.status before rendering
- API endpoints verify subscription status
- Direct URL attempts redirect to upgrade page

✅ **Discord connection is self-service**
- User can connect from onboarding or dashboard
- If OAuth fails, clear error message shown
- User can retry unlimited times without support
- Success updates User.discordId and discordConnected

✅ **Discord role syncs with subscription status**
- Active Purchase → "Member" role
- Cancelled Purchase → "Support Only" role
- Changes happen automatically via webhook

✅ **Affiliate links track correctly**
- Rewardful attribution works on all purchases
- Dashboard shows accurate referral count
- Earnings update within 24 hours
- Links are unique per user

✅ **Admin can manage everything**
- Create manual accounts with override Purchase
- View all users and their Purchase status
- Publish/unpublish content
- See platform analytics

✅ **Grace period functions correctly**
- Payment failure sets Purchase.status = 'grace_period'
- User notified via email and dashboard banner
- Access continues during grace period
- Access revoked after 3 days (Purchase.status = 'cancelled')

✅ **All emails send reliably**
- Welcome email on account creation
- Purchase confirmation
- Renewal reminders (3 days before currentPeriodEnd)
- Grace period warnings
- Discord connection reminders (if discordConnected=false after 24h)

### Can Be Rough (Nice to Polish Later)

⚠️ **UI polish and animations**
- Basic styling is fine
- Smooth animations are nice-to-have
- Perfect responsive design on all devices

⚠️ **Loading states**
- Basic loading spinners are fine
- Skeleton screens are nice-to-have

⚠️ **Advanced error messages**
- Generic "Something went wrong" is acceptable
- Detailed error codes are nice-to-have

⚠️ **Video progress tracking**
- Not needed for v1
- Can add post-launch

### Doesn't Need to Exist Yet

❌ **TikTok API integration**
❌ **Resource library**
❌ **Multiple subscription tiers**
❌ **Content drip scheduling**
❌ **In-app community forum**
❌ **Mobile app**

---

## CRITICAL REMINDERS

### Security First
- **Test RLS policies thoroughly** - This is where beta failed
- **Never trust client-side checks** - Always verify Purchase.status server-side
- **Server components must check subscription** - Don't rely on UI hiding links
- **Webhook signature verification** - Prevent fake Stripe events
- **Admin role checks** - Query AdminUser table, not just frontend checks

### Development Speed
- **Use Supastarter patterns** - Don't fight the Purchase table
- **Use Prisma** - Don't write raw SQL
- **v0 for every UI screen** - Never write components from scratch
- **One feature per day** - If it takes longer, cut scope
- **Deploy daily** - Catch issues in production environment

### Communication
- **Document decisions** - Future you (or hired dev) needs context
- **Clear commit messages** - "Fix auth" is bad, "Add Purchase check to content routes" is good
- **Test on production** - Staging never catches everything

### Scope Management
If you're behind schedule by Day 10:
1. Cut video progress tracking
2. Simplify admin dashboard (just user management)
3. Reduce email templates to 3 essentials
4. Skip analytics/stats (add post-launch)

The goal is **alpha-ready in 4 weeks**, not perfect-ready.

---

## SUPPORT RESOURCES

### Documentation Links
- **Supastarter Docs:** https://supastarter.dev/docs/nextjs
- **Tech Stack:** https://supastarter.dev/docs/nextjs/tech-stack
- **Setup Guide:** https://supastarter.dev/docs/nextjs/setup
- **Configuration:** https://supastarter.dev/docs/nextjs/configuration
- **Troubleshooting:** https://supastarter.dev/docs/nextjs/troubleshooting

### External Documentation
- **Next.js 15:** https://nextjs.org/docs
- **Prisma:** https://www.prisma.io/docs
- **Supabase:** https://supabase.com/docs
- **Stripe Webhooks:** https://stripe.com/docs/webhooks
- **Discord OAuth:** https://discord.com/developers/docs/topics/oauth2
- **Rewardful API:** https://www.getrewardful.com/docs
- **Resend:** https://resend.com/docs

### When You're Stuck
1. Check Supastarter docs for their pattern
2. Search v0 community for similar UI
3. Start fresh Claude chat with specific PRD section + Prisma context
4. Ask in Supastarter Discord (they have support channel)
5. Screenshot competitor site, feed to Claude: "recreate this"

---

## VERSION HISTORY

**v1.0 - Alpha (Original PRD)**
- Created: November 2025
- Status: Superseded by V2

**v2.0 - Alpha (This Document)**
- Updated: December 2, 2025
- Changes: Aligned with Supastarter's Prisma/Purchase architecture
- Status: In Progress
- Target: 4 weeks to stress test, January public launch

---

## POST-ALPHA ROADMAP

### v1.1 Features (Post-January Launch)

**TikTok API Integration**
- Creator data dashboard (views, engagement, follower growth)
- Campaign tracking per video
- Connect to TikTok's Creator API
- Real-time trending video data
- Performance analytics for creators

**Resource Library Expansion**
- Curated commission lists (high-paying brands)
- Sample request forms for brands
- Flash sale announcement system
- Giveaway coordination tools
- Brand partnership directory

**Enhanced Agency Features**
- Form builder for creator applications
- Automated creator onboarding
- Campaign assignment system
- Creator tier system (bronze/silver/gold)

### v1.2 Features (Future)

**Additional Subscription Tiers**
- Basic ($99/mo) - Current feature set
- Pro ($199/mo) - Advanced analytics + priority support
- Agency ($499/mo) - Team accounts + white-label options

**One-Time Upsells**
- Advanced courses ($297)
- Live workshop recordings ($97)
- Template packs ($47)
- 1-on-1 coaching sessions ($500)

**Platform Enhancements**
- Content drip scheduling (unlock videos over time)
- Certificate system for course completion
- Community forum (in-app, not just Discord)
- Live Q&A streaming
- Mobile app (React Native)

---

**END OF PRD V2**

*Reference this document at the start of every development session. When in doubt, come back to the Critical Success Factors and Acceptance Criteria. Use Supastarter patterns. Ship it.* 🚀
