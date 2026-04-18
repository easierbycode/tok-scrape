---
name: Live Stripe Transition + Testing Plan
overview: Transition the app from Stripe test mode to live mode (updating all keys, products, webhooks, Rewardful, and Discord), then execute a full regression test covering the purchase flow and recent admin/subscription UI changes.
todos:
  - id: stripe-live-products
    content: Create live products and prices in Stripe Dashboard (Monthly, Yearly, Lifetime), note all new IDs
    status: pending
  - id: stripe-live-webhook
    content: Register live webhook endpoint in Stripe Dashboard for /api/webhooks/payments, copy signing secret
    status: pending
  - id: vercel-env-vars
    content: "Update 6 Stripe env vars in Vercel: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRODUCT_ID, and 3 price IDs"
    status: pending
  - id: db-price-ids
    content: Update MarketingPricingPlan table in DB to point to live Stripe price IDs
    status: pending
  - id: rewardful-verify
    content: Verify Rewardful campaign is in live mode and Stripe integration points to live account
    status: pending
  - id: discord-verify
    content: Verify Discord OAuth redirect URI includes production URL and bot is online post-deploy
    status: pending
  - id: purchase-flow-test
    content: "Run end-to-end purchase flow tests: monthly, yearly, lifetime, and rewardful attribution"
    status: pending
  - id: admin-ui-tests
    content: Execute Tests 1-10 for ViewSubscriptionDialog, badges, CSV export, and edge cases
    status: pending
isProject: false
---

# Live Stripe Transition + Testing Plan

## Part 1: Stripe Live Transition

### Step 1 — Create Live Products & Prices in Stripe Dashboard

In the **live** Stripe Dashboard (switch the toggle from "Test" to "Live"):

1. Create or confirm a Product (e.g., "Lifepreneur Pro")
2. Create three Prices under that product:
  - Monthly recurring — note the `price_live_...` ID
  - Yearly recurring — note the `price_live_...` ID
  - Lifetime one-time — note the `price_live_...` ID
3. Note the live Product ID (`prod_live_...`)

### Step 2 — Register a Live Webhook

In Stripe Dashboard → Developers → Webhooks → "Add endpoint":

- **URL:** `https://your-prod-domain.com/api/webhooks/payments`
- **Events to listen for:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy the **Signing secret** (`whsec_live_...`)

### Step 3 — Update Environment Variables in Vercel

Go to Vercel project → Settings → Environment Variables. Update **all environments** (Production at minimum):


| Variable                           | Old (test) value      | New (live) value               |
| ---------------------------------- | --------------------- | ------------------------------ |
| `STRIPE_SECRET_KEY`                | `sk_test_...`         | `sk_live_...`                  |
| `STRIPE_WEBHOOK_SECRET`            | `whsec_test_...`      | `whsec_live_...` (from Step 2) |
| `STRIPE_PRODUCT_ID`                | `prod_Td1xMr6vz7qt8z` | `prod_live_...` (from Step 1)  |
| `NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY` | `price_1SfltU...`     | `price_live_monthly_...`       |
| `NEXT_PUBLIC_PRICE_ID_PRO_YEARLY`  | `price_1SfltU...`     | `price_live_yearly_...`        |
| `NEXT_PUBLIC_PRICE_ID_LIFETIME`    | `price_1T5Uko...`     | `price_live_lifetime_...`      |


Also confirm `NEXT_PUBLIC_APP_URL` is set to your production domain (not localhost).

**Trigger a Vercel redeploy** after saving all variables.

### Step 4 — Update `MarketingPricingPlan` DB Records

The lifetime plan (and any other plans) have `stripePriceId` stored in the database (`MarketingPricingPlan` table). Update these rows via your admin panel or Supabase SQL editor to point to the new live price IDs — otherwise the lifetime checkout page will send the wrong `priceId`.

```sql
UPDATE "MarketingPricingPlan"
SET "stripe_price_id" = 'price_live_lifetime_...'
WHERE "plan_type" = 'lifetime';
```

Repeat for monthly/yearly if stored in the DB.

### Step 5 — Verify Rewardful Attribution

Rewardful uses a **client-side snippet** identified by `NEXT_PUBLIC_REWARDFUL_ID` (`2e46d0`). This ID is the same across test/live — confirm in Rewardful dashboard that:

1. The campaign (`60d468fa-0957-44b5-9639-d5641ef3ff86`) is in **live** mode (not test)
2. The Stripe integration in Rewardful is connected to the **live** Stripe account
  - Rewardful Dashboard → Settings → Integrations → Stripe → confirm it shows "Live Mode"
3. The `referral` field passed to Stripe checkout (via `client_reference_id` or metadata) is populated — verify in `[packages/payments/provider/stripe/index.ts](packages/payments/provider/stripe/index.ts)` that `rewardfulReferralId` is included in checkout session creation
4. After a live test purchase via an affiliate link, check Rewardful dashboard for a new conversion

### Step 6 — Verify Discord Connection After Go-Live

The Discord env vars (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, role IDs) are not Stripe-specific and should carry over unchanged — confirm:

1. Bot is still online in your Discord server after redeployment
2. Do a post-purchase test: connect Discord on a test account, complete a live checkout, verify `DISCORD_ACTIVE_ROLE_ID` is granted
3. Check the Discord OAuth redirect URI in [Discord Developer Portal](https://discord.com/developers/applications) includes your production URL: `https://your-prod-domain.com/api/auth/callback/discord`

---

## Part 2: Purchase Flow End-to-End Tests (Live Mode)

Run these **after deployment** with the live Stripe keys active. Use a real card (Stripe recommends a $1 plan or use a refundable test).

### Flow A — Monthly Subscription

1. Visit `/pricing` → click "Monthly" → complete checkout with a real card
2. Verify: confirmation redirect hits `/auth/post-checkout-login`
3. Verify: `Purchase` record created in DB with `type: "SUBSCRIPTION"`, `status: "active"`
4. Verify: user's Stripe Customer ID is stored on the `User` record
5. Verify: if Discord connected, `DISCORD_ACTIVE_ROLE_ID` is granted within ~30 seconds of webhook

### Flow B — Yearly Subscription

- Same as Flow A but select "Yearly" price
- Verify billing interval shows "Yearly" in admin ViewSubscriptionDialog

### Flow C — Lifetime One-Time Purchase

1. Visit `/checkout/lifetime` → complete checkout
2. Verify: redirect to `/auth/post-checkout-login`
3. Verify: `Purchase` record created with `type: "ONE_TIME"`, `status: "active"`
4. Verify: Discord role granted automatically if Discord connected
5. Verify: admin ViewSubscriptionDialog shows "Lifetime" plan, violet badge, no renewal date

### Flow D — Rewardful Attribution

1. Get a Rewardful affiliate link (e.g., `?via=affiliateslug`)
2. Visit the site via that link — confirm Rewardful cookie/script fires (`window.Rewardful`)
3. Complete a lifetime or monthly checkout
4. Verify: `Purchase.rewardfulReferralId` is populated in DB
5. Verify: Rewardful dashboard shows a new conversion for the affiliate

---

## Part 3: Admin Panel & Subscription UI Tests (Recent Changes)

These tests verify the ViewSubscriptionDialog, status badges, CSV export, and user table introduced in recent changes.

### Test 1 — ViewSubscriptionDialog: Lifetime User

- `/admin/users` → find a user with lifetime purchase → Actions → "View Subscription"
- Verify: Plan name = "Lifetime", violet badge, "Lifetime Access" callout visible
- Verify: no Billing Cycle / Next Renewal rows
- Verify: Stripe Customer ID row present with copy + external link; no Subscription ID row
- Verify: Created date displayed

### Test 2 — ViewSubscriptionDialog: Monthly/Yearly Subscriber

- Find active subscription user → "View Subscription"
- Verify: Plan name = "Monthly" or "Yearly", green "Active" badge
- Verify: Billing Cycle row present, Next Renewal shows a date (or "Cancels at period end")
- Verify: Both Customer ID and Subscription ID rows present with copy buttons

### Test 3 — ViewSubscriptionDialog: Manual Access User

- Find user with manually granted access → "View Subscription"
- Verify: Plan name = "Manual Access", blue "Manually Granted Access" callout
- Verify: No Billing Cycle / Next Renewal / Subscription ID rows

### Test 4 — ViewSubscriptionDialog: No Subscription

- Find user with no purchases → "View Subscription"
- Verify: Yellow "No Subscription Data" message

### Test 5 — User-Facing Lifetime Badge (`/app/settings/billing`)

- Log in as lifetime user → navigate to Settings → Billing
- Verify: "Your plan" section shows **green "Lifetime"** badge (not "Active")
- Verify: Plan title still shows "Pro" from plan config

### Test 6 — User-Facing Active Subscriber Badge

- Log in as monthly/yearly subscriber → Settings → Billing
- Verify: Badge shows "Active" (no regression)

### Test 7 — User-Facing Manual Access Badge

- Log in as manual-access user → Settings → Billing
- Verify: Badge shows "Active"

### Test 8 — Admin User Table: Lifetime Badge + Filter

- `/admin/users` → confirm lifetime users show violet "Lifetime" badge
- Use subscription filter dropdown → select "Lifetime"
- Verify: only lifetime users appear in table

### Test 9 — CSV Export

- `/admin/users` → click "Export"
- Open downloaded CSV and verify:
  - 14 columns: Name, Email, Stripe Email, Notification Email, Subscription Status, Plan Label, Stripe Customer ID, Stripe Subscription ID, Discord Connected, Is Admin, Is Affiliate, Affiliate Slug, Referred By, Joined Date
  - Lifetime users: `Subscription Status = lifetime`, `Plan Label = Lifetime`
  - Stripe Email populated for users who have it
  - Affiliate Slug populated for affiliates
  - Empty strings (not `"undefined"`) for missing optional fields

### Test 10 — Edge Case: Manual + Lifetime User

- Create a test user with both a manual override AND a real ONE_TIME Stripe purchase
- Admin panel: should show "manual" status (manual takes priority over lifetime)
- User billing page: should show "Active" badge
- Revoke manual access → admin should now show "Lifetime", billing page shows "Lifetime" badge

---

## Environment Variable Reference (Vercel)

Complete list of Stripe-related variables to update in Vercel Production:

- `STRIPE_SECRET_KEY` — live secret key (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` — live webhook signing secret (`whsec_live_...`)
- `STRIPE_PRODUCT_ID` — live product ID
- `NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY` — live monthly price ID
- `NEXT_PUBLIC_PRICE_ID_PRO_YEARLY` — live yearly price ID
- `NEXT_PUBLIC_PRICE_ID_LIFETIME` — live lifetime price ID
- `NEXT_PUBLIC_APP_URL` — must be production URL (not localhost)

Variables that do NOT need to change for live Stripe:

- All `DISCORD`_* vars (server/bot specific, not Stripe-related)
- `REWARDFUL`_* vars (same campaign ID works, just ensure Stripe integration in Rewardful is live mode)
- `DATABASE_URL`, auth secrets, Google OAuth, S3, etc.

