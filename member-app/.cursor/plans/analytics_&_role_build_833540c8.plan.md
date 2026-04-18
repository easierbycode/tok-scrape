---
name: Analytics & Role Build
overview: "Build out the 5-phase plan: role infrastructure, analytics hub with Shadcn Charts + PostHog, command center page, audit improvements, and product usage event instrumentation."
todos:
  - id: p1-roles-constants
    content: "Phase 1: Create packages/api/lib/roles.ts with 5 role constants"
    status: completed
  - id: p1-procedure
    content: "Phase 1: Update adminProcedure in procedures.ts to accept owner + admin"
    status: completed
  - id: p1-assign-role
    content: "Phase 1: Update assign-role.ts input schema to accept all 5 roles with summary metadata"
    status: completed
  - id: p1-auth-default
    content: "Phase 1: Add defaultRole: user to Better Auth admin() plugin or add databaseHooks"
    status: completed
  - id: p1-layout
    content: "Phase 1: Update admin layout role check for owner + fix email casing inconsistency"
    status: completed
  - id: p1-dialog
    content: "Phase 1: Update AssignRoleDialog to show all 5 roles with descriptions"
    status: completed
  - id: p2-shadcn-charts
    content: "Phase 2: Install Shadcn Charts in apps/web"
    status: cancelled
  - id: p2-posthog-install
    content: "Phase 2: Install posthog-js and posthog-node, create client/server provider files"
    status: completed
  - id: p2-analytics-procedure
    content: "Phase 2: Add analyticsProcedure to procedures.ts"
    status: completed
  - id: p2-revenue-api
    content: "Phase 2: Create packages/api/modules/admin/procedures/analytics/revenue.ts"
    status: completed
  - id: p2-lifecycle-api
    content: "Phase 2: Create packages/api/modules/admin/procedures/analytics/lifecycle.ts"
    status: completed
  - id: p2-discord-analytics-guard
    content: "Phase 2: Switch getDiscordAnalytics from adminProcedure to analyticsProcedure"
    status: completed
  - id: p2-router
    content: "Phase 2: Wire analytics procedures into admin router"
    status: completed
  - id: p2-layout-viewer
    content: "Phase 2: Update admin layout to admit analytics_viewer and redirect to /admin/analytics"
    status: completed
  - id: p2-analytics-page
    content: "Phase 2: Build /admin/analytics with 4 tabs using Shadcn Charts"
    status: completed
  - id: p3-command-center
    content: "Phase 3: Build /admin/command-center page with watchlist + system status + MRR snapshot"
    status: pending
  - id: p3-admin-home
    content: "Phase 3: Update admin home page to be role-aware, remove Quick Actions card"
    status: pending
  - id: p3-sidebar
    content: "Phase 3: Update AdminSidebar to filter nav items by role, add Command Center item"
    status: completed
  - id: p4-audit-logger
    content: "Phase 4: Replace console.log/error in audit-logger.ts with logger.info/error"
    status: completed
  - id: p4-schema-enum
    content: "Phase 4: Add 5 new AuditAction enum values to schema.prisma and run migration"
    status: completed
  - id: p4-new-audit-rows
    content: "Phase 4: Add logAdminAction to export-user-data, link-to-user, unlink-from-user, sync-stripe, restore-user"
    status: completed
  - id: p4-summary-convention
    content: "Phase 4: Add metadata.summary to all ~30 existing logAdminAction call sites"
    status: completed
  - id: p5-events
    content: "Phase 5: Add PostHog event tracking to 8 identified user action points"
    status: completed
  - id: p5-product-usage-tab
    content: "Phase 5: Wire Product Usage tab in analytics hub to PostHog dashboard embed"
    status: completed
isProject: false
---

# Analytics & Role System Build Plan

## Architecture Overview

```mermaid
flowchart TD
    subgraph roles [Role Hierarchy]
        owner[owner] --> analytics_viewer[analytics_viewer]
        owner --> admin[admin - future]
        owner --> support[support - future]
        analytics_viewer --> user[user]
        admin --> user
        support --> user
    end

    subgraph guards [Route Guards]
        adminProcedure["adminProcedure\n(owner + admin + superAdmin)"]
        analyticsProcedure["analyticsProcedure\n(owner + analytics_viewer + admin + superAdmin)"]
        adminLayout["Admin Layout Guard\n(all non-user roles)"]
    end

    subgraph pages [Pages]
        allPages[All admin pages] --> adminProcedure
        analyticsHub[/admin/analytics] --> analyticsProcedure
        commandCenter[/admin/command-center] --> adminProcedure
    end
```



---

## Phase 1: Role Infrastructure

### What changes

**New file — `packages/api/lib/roles.ts`**
Define role constants as a typed map:

```ts
export const ROLES = {
  OWNER: "owner",
  ANALYTICS_VIEWER: "analytics_viewer",
  ADMIN: "admin",
  SUPPORT: "support",
  USER: "user",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
```

`**[packages/api/orpc/procedures.ts](packages/api/orpc/procedures.ts)**`
Update `adminProcedure` role check from `role === "admin"` to:

```ts
const isAdmin = role === "owner" || role === "admin";
```

Keep `admin` accepted for backward compatibility until your own account is updated.

`**[packages/api/modules/admin/procedures/users/assign-role.ts](packages/api/modules/admin/procedures/users/assign-role.ts)**`
Expand input schema from `z.enum(["admin"]).nullable()` to accept all 5 roles:

```ts
role: z.enum(["owner", "analytics_viewer", "admin", "support", "user"]).nullable()
```

Update the `logAdminAction` metadata to include `previousRole` and `metadata.summary`.

`**[packages/auth/auth.ts](packages/auth/auth.ts)**`
Add `defaultRole` to the `admin()` plugin config to assign `"user"` to new signups:

```ts
admin({ defaultRole: "user" })
```

If Better Auth's plugin does not support `defaultRole`, add a `databaseHooks.user.create.after` hook that sets `role: "user"` on new user rows.

`**[apps/web/app/(admin)/admin/layout.tsx](apps/web/app/(admin)`/admin/layout.tsx)**
Update client-side role check to accept `owner` and `admin`. Note: also fix the casing inconsistency — the layout uses `NEXT_PUBLIC_SUPER_ADMIN_EMAILS` without lowercasing (the API does lowercase). Align both to lowercase comparison.

`**[apps/web/modules/saas/admin/component/users/AssignRoleDialog.tsx](apps/web/modules/saas/admin/component/users/AssignRoleDialog.tsx)`**
Replace the binary admin/user radio with a 5-option radio group showing all roles with name, description, and access summary per role. Change `isAdmin: boolean` in the `User` interface to `role: string | null`.

### Manual actions (you)

1. After deploy: In admin → Users, find your own account → assign role `owner` via the new dialog.
2. Verify you can still access all admin pages after role change.
3. Backfill existing `null` roles via Prisma Studio: set all users currently with `null` role to `user`. (Only a few accounts exist now — safe to do manually.)

### Testing

- Sign up a fresh test account → confirm role defaults to `user`.
- Assign `analytics_viewer` to a test account → confirm it saves, confirm that account redirects to `/app` when trying to reach `/admin` (analytics route guard not yet added until Phase 2, so this is expected).
- Assign `owner` to your account → confirm full admin access unchanged.
- Try assigning a role as the test `analytics_viewer` account → should be blocked (403).

---

## Phase 2: Analytics Hub + Analytics Viewer + PostHog

### What changes

**Install Shadcn Charts** (`pnpm dlx shadcn@latest add chart` in `apps/web`).

**Install PostHog**

- `posthog-js` in `apps/web`
- `posthog-node` in `packages/api`
- New file: `apps/web/lib/posthog.ts` — PostHog client provider (wraps `posthog-js`, reads `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST`)
- New file: `packages/api/lib/posthog-server.ts` — server-side PostHog client for API-side events

`**[apps/web/app/(admin)/admin/layout.tsx](apps/web/app/(admin)`/admin/layout.tsx)**
Update role check to also admit `analytics_viewer`. Add a redirect: if role is `analytics_viewer` and path is not `/admin/analytics*`, redirect to `/admin/analytics`.

**New procedure — `analyticsProcedure` in `[packages/api/orpc/procedures.ts](packages/api/orpc/procedures.ts)`**
Accepts `owner`, `admin`, `analytics_viewer`, and `isSuperAdmin`. Used by analytics-only routes.

**New API module — `packages/api/modules/admin/procedures/analytics/`**

- `revenue.ts` — GET `/admin/analytics/revenue`. Queries `Purchase` for: MRR (sum of `cachedAmount` where `status = active`), new subscribers per month, churn per month (`cancelledAt` grouped by month), plan distribution (`productId` grouped), affiliate vs direct split (`rewardfulReferralId` null vs not null). Uses `analyticsProcedure`.
- `lifecycle.ts` — GET `/admin/analytics/lifecycle`. Queries: signup count by month (`User.createdAt`), time from signup to first purchase (join `User` + `Purchase`), time from signup to Discord connect (join `User.createdAt` + `discordConnectedAt`), subscriber retention (active cohorts reconstructed from `Purchase`). Uses `analyticsProcedure`.

**Update existing procedure** `[packages/api/modules/admin/procedures/discord/analytics.ts](packages/api/modules/admin/procedures/discord/analytics.ts)`
Switch from `adminProcedure` to `analyticsProcedure` so `analytics_viewer` can call it.

**Wire new procedures** into `[packages/api/modules/admin/router.ts](packages/api/modules/admin/router.ts)` under `analytics: { revenue, lifecycle }`.

`**[apps/web/app/(admin)/admin/analytics/page.tsx](apps/web/app/(admin)`/admin/analytics/page.tsx)**
Replace the placeholder with a tabbed layout (Shadcn `Tabs`):

- **Revenue tab** — MRR line chart, new vs churned bar chart, plan distribution pie chart, affiliate vs direct split. Data from `orpc.admin.analytics.revenue`.
- **Community tab** — Discord connect rate over time, role distribution, time-to-connect histogram, members who left. Data from `orpc.admin.discord.analytics` (existing procedure, now on `analyticsProcedure`).
- **Product Usage tab** — PostHog embedded dashboard or a "PostHog collecting — check back soon" state with estimated data-available date. Will populate in Phase 5.
- **Customer Lifecycle tab** — Signup funnel (signed up → subscribed → Discord connected), cohort retention table. Data from `orpc.admin.analytics.lifecycle`.

### Manual actions (you)

1. ~~Create a PostHog account at posthog.com (free tier).~~ **Already done.**
2. PostHog project already created. Your values (add these to Vercel env vars before deploy):
  - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_Az53UrGqu2AscvQNV5gDkKfH7yYy7rtWVcNZcjjov7je`
  - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com` (your region is US Cloud)
3. After deploy: Log in as a test `analytics_viewer` account → confirm redirect to analytics, confirm sidebar only shows Analytics, confirm no access to Users or Subscriptions pages.

### Testing

- All 4 tabs load without errors.
- Revenue tab shows real numbers that match what you know (compare MRR to Stripe).
- Community tab data matches Discord server member count.
- `analytics_viewer` account can reach analytics page, gets 403 on any other admin API call.
- PostHog project shows at least one pageview event after deploy.

---

## Phase 3: Command Center + Admin Home Cleanup

### What changes

**New page — `[apps/web/app/(admin)/admin/command-center/page.tsx](apps/web/app/(admin)`/admin/command-center/page.tsx)**
Owner-only (redirect non-owner to `/admin`). Three sections:

- **Customer success watchlist** — four query-driven lists: users in grace period, subscribers who canceled in last 14 days, subscribers with no Discord connect after 7 days, users with `cancelAtPeriodEnd = true` expiring within 7 days. Each entry is a row with name/email + quick-action link to that user's admin profile.
- **System status** — last run time + result of each cron job (query `WebhookEvent` by type, most recent processed row per cron path), Discord bot last health check result.
- **MRR snapshot** — single number card (same query as Revenue tab, no chart needed here).

`**[apps/web/app/(admin)/admin/page.tsx](apps/web/app/(admin)`/admin/page.tsx)**
Fetch the user's role server-side. Filter `sections` array by role:

- `analytics_viewer` sees only the Analytics card.
- `owner` sees all cards plus a new **Command Center** card.
- Remove the "Quick actions" dashed-border card — move any useful content into Command Center.

`**[apps/web/modules/saas/admin/component/AdminSidebar.tsx](apps/web/modules/saas/admin/component/AdminSidebar.tsx)`**
Read role from session. Filter `menuItems` array:

- `analytics_viewer`: only show Analytics.
- `owner`/`admin`/`isSuperAdmin`: show all items plus a new **Command Center** item at the top of the list.

**New API queries** for the watchlist (inline in the page or in a new `packages/api/modules/admin/procedures/command-center/watchlist.ts` procedure on `adminProcedure`).

### Manual actions (you)

1. After deploy: Visit `/admin/command-center` and confirm the watchlist reflects real data from your DB.
2. Confirm admin home is cleaner — no more Quick Actions card.

### Testing

- Log in as `analytics_viewer` → admin home shows only Analytics card, sidebar shows only Analytics.
- Log in as `owner` → admin home shows all cards + Command Center, sidebar shows all items.
- Command center watchlist shows any users currently in grace period or recently churned.
- Non-owner trying to load `/admin/command-center` directly is redirected.

---

## Phase 4: Audit Improvements

### What changes

`**[packages/database/lib/audit-logger.ts](packages/database/lib/audit-logger.ts)`**

- Replace `console.log` with `logger.info` (import `logger` from `@repo/logs`).
- Replace `console.error` with `logger.error`.
- Add `summary` as an optional top-level field on `AuditLogParams`, written into `metadata.summary` automatically if provided but no manual `metadata.summary` is set.

`**[packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)`**
Add new values to the `AuditAction` enum:

```
EXPORT_USER_DATA
RESTORE_USER
LINK_AFFILIATE
UNLINK_AFFILIATE
SYNC_STRIPE
```

Run `prisma migrate dev` to generate the migration (safe non-breaking enum extension in Postgres).

**Add `logAdminAction` to 4 currently unlogged procedures:**


| File                                                                                                                                         | Action             | Example summary                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| `[packages/api/modules/admin/procedures/users/export-user-data.ts](packages/api/modules/admin/procedures/users/export-user-data.ts)`         | `EXPORT_USER_DATA` | `"Exported personal data for {email}"`                    |
| `[packages/api/modules/admin/procedures/rewardful/link-to-user.ts](packages/api/modules/admin/procedures/rewardful/link-to-user.ts)`         | `LINK_AFFILIATE`   | `"Linked Rewardful affiliate {slug} to {email}"`          |
| `[packages/api/modules/admin/procedures/rewardful/unlink-from-user.ts](packages/api/modules/admin/procedures/rewardful/unlink-from-user.ts)` | `UNLINK_AFFILIATE` | `"Unlinked affiliate {slug} from {email}"`                |
| `[packages/api/modules/admin/procedures/subscriptions/sync-stripe.ts](packages/api/modules/admin/procedures/subscriptions/sync-stripe.ts)`   | `SYNC_STRIPE`      | `"Manual Stripe sync: {synced} updated, {errors} errors"` |


Also add `RESTORE_USER` action to `[packages/database/lib/gdpr-deletion.ts](packages/database/lib/gdpr-deletion.ts)` `restoreUser()` function (already receives `restoredBy` userId).

**Add `metadata.summary` to all existing `logAdminAction` calls** across the ~30 call sites in `packages/api/modules/admin/procedures/`. Each summary is a plain-English one-liner describing the action using available context variables.

### Manual actions (you)

1. Run `pnpm exec prisma migrate dev --name "add-audit-action-enum-values"` in `packages/database` after the schema change.
2. After deploy: Trigger each new audited action once via admin UI and confirm the row appears in the Audit Log page with a readable summary.
3. Check Vercel logs for the next admin action — confirm no `[AuditLog]` console.log lines appear (only structured logger output).

### Testing

- Export user data for a test user → confirm audit row appears with `EXPORT_USER_DATA` and summary including the target user's email.
- Link and unlink a test Rewardful affiliate → two rows with `LINK_AFFILIATE` / `UNLINK_AFFILIATE`.
- Run manual Stripe sync → one row with `SYNC_STRIPE` and synced/error counts.
- Check 5 random existing audit rows → all have a non-empty `metadata.summary` field visible on the audit log page.

---

## Phase 5: Product Usage Events

### What changes

**PostHog event instrumentation** (PostHog client installed in Phase 2, events added here):


| Event name                  | Where triggered                      | File to update                 |
| --------------------------- | ------------------------------------ | ------------------------------ |
| `affiliate_cta_clicked`     | Click on Rewardful external link     | Affiliate dashboard page       |
| `discord_connect_started`   | User clicks "Connect Discord" button | Discord connect flow component |
| `discord_connect_completed` | Successful OAuth callback            | Discord OAuth callback handler |
| `billing_portal_opened`     | User clicks "Manage Billing"         | Billing settings page          |
| `help_article_viewed`       | Help article page load               | Help article page              |
| `help_article_voted`        | Helpful / not helpful click          | Help article vote component    |
| `announcement_engaged`      | User clicks announcement CTA         | Announcement component         |
| `announcement_dismissed`    | User dismisses announcement          | Announcement component         |


Each event captures: anonymous/pseudonymous user id, timestamp, and relevant properties (e.g. article slug, announcement id) — no PII (no name or email in event properties).

`**[apps/web/app/(admin)/admin/analytics/page.tsx](apps/web/app/(admin)`/admin/analytics/page.tsx)**
Update the Product Usage tab from placeholder to a live PostHog data view. Options:

- Embed PostHog's shareable dashboard iframe (simplest — PostHog generates an embed URL).
- OR query PostHog's API server-side and render charts with Shadcn Charts (more control, more work).

Recommend starting with the iframe embed to ship fast, then replace with custom charts later.

### Manual actions (you)

**Wait until Phase 5 code is deployed first — events need to be flowing before you build the dashboard.**

1. **Create a PostHog dashboard:**
  - Log into posthog.com → your project
  - Left sidebar → **Dashboards** → **New Dashboard** → name it "Product Usage"
  - Click **Add insight** → choose **Trends** chart type
  - In the event selector, pick one of the 8 event names (e.g. `affiliate_cta_clicked`)
  - Click **Save** — the chart tile appears on the dashboard
  - Repeat **Add insight** for each of the remaining 7 events
  - You can also add **Funnel** insights: e.g. `discord_connect_started` → `discord_connect_completed`
2. **Generate a shareable embed URL:**
  - On the dashboard page, click the **Share** button (top-right)
  - Toggle **Enable embedding** on
  - PostHog generates a URL like `https://us.posthog.com/embedded/dashboard/abc123`
  - Copy that URL
3. Add the embed URL as `POSTHOG_DASHBOARD_EMBED_URL` to Vercel env vars.
4. After deploy: manually trigger each event in the live app and confirm it appears in PostHog's **Live Events** feed (left sidebar → Activity → Live Events) within 30 seconds.

### Testing

- Click affiliate CTA → PostHog Live Events shows `affiliate_cta_clicked`.
- Start and complete Discord connect as a test user → two events appear in sequence.
- Open billing portal → `billing_portal_opened` event appears.
- Product Usage tab in analytics hub shows the embedded PostHog dashboard (or error state if env var not set).
- Confirm no user emails or names appear in any PostHog event properties.

