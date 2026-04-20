---
name: "Phase 8: Testing & Refinement"
overview: Eliminate all remaining frontend mock data, then conduct comprehensive testing of all 21+ backend procedures, integration workflows, Stripe webhooks, Discord integration, error handling, and performance before production deployment.
todos:
  - id: mock-elimination
    content: "Section 0: Eliminate ALL frontend mock data (mock-api.ts, mock-data.ts)"
    status: pending
  - id: affiliate-real-api
    content: Replace affiliate mock with real API in all 7 component files
    status: pending
  - id: subscription-banner-real
    content: Replace subscription banner mock with session data
    status: pending
  - id: community-real-api
    content: Replace community hub mock with ORPC calls
    status: pending
  - id: delete-mock-files
    content: Delete mock-api.ts, mock-data.ts, test-mock page
    status: pending
  - id: verify-no-mocks
    content: Verify zero mock imports remain in codebase
    status: pending
  - id: test-procedures
    content: "Section 1: Test all 21+ procedures individually"
    status: pending
  - id: test-integrations
    content: "Section 2: Test 4 integration workflows end-to-end"
    status: pending
  - id: test-stripe-webhooks
    content: "Section 3: Test Stripe webhooks with CLI"
    status: pending
  - id: test-discord
    content: "Section 4: Test Discord OAuth and role management"
    status: pending
  - id: test-error-handling
    content: "Section 5: Test error handling and edge cases"
    status: pending
  - id: test-performance
    content: "Section 6: Check for N+1 queries and slow queries"
    status: pending
  - id: test-frontend
    content: "Section 7: Test all admin and user pages for compatibility"
    status: pending
  - id: create-test-report
    content: "Section 8: Create comprehensive test report"
    status: pending
  - id: final-verification
    content: Run BCP8 final verification checklist
    status: pending
---

# Phase 8: Testing & Refinement

**Duration:** 12-16 hours (8-10 original + 4-6 for mock elimination)**Goal:** Eliminate ALL mock data and comprehensively test backend integration before alpha launch---

## Section 0: CRITICAL - Frontend Mock Elimination (4-6 hours)

**Must complete BEFORE testing begins**

### 0.1: Audit Current Mock Usage

Files using mock data:

- [`apps/web/lib/mock-api.ts`](apps/web/lib/mock-api.ts) (789 lines)
- [`apps/web/lib/mock-data.ts`](apps/web/lib/mock-data.ts) (760 lines)
- 13 component/page files importing from above

**Key affected areas:**

1. **Affiliate System** (highest priority - user-facing)
2. Subscription Status Banner
3. Community Hub (announcements)
4. Category Labels

### 0.2: Replace Affiliate Mock with Real API

**Files to update:**

- [`apps/web/modules/saas/affiliate/components/affiliate-dashboard.tsx`](apps/web/modules/saas/affiliate/components/affiliate-dashboard.tsx)
- [`apps/web/modules/saas/affiliate/components/earnings-tab.tsx`](apps/web/modules/saas/affiliate/components/earnings-tab.tsx)
- [`apps/web/modules/saas/affiliate/components/referrals-tab.tsx`](apps/web/modules/saas/affiliate/components/referrals-tab.tsx)
- [`apps/web/modules/saas/affiliate/components/payouts-tab.tsx`](apps/web/modules/saas/affiliate/components/payouts-tab.tsx)
- [`apps/web/modules/saas/affiliate/components/links-tab.tsx`](apps/web/modules/saas/affiliate/components/links-tab.tsx)
- [`apps/web/modules/saas/affiliate/components/affiliate-signup.tsx`](apps/web/modules/saas/affiliate/components/affiliate-signup.tsx)
- [`apps/web/app/(saas)/app/(account)/affiliate/page.tsx`](apps/web/app/\\(saas)/app/(account)/affiliate/page.tsx)

**Backend endpoint exists:** [`packages/api/modules/users/procedures/affiliate/status.ts`](packages/api/modules/users/procedures/affiliate/status.ts)**Pattern:**

```typescript
// BEFORE (mock)
import { mockGetAffiliate } from "@/lib/mock-api";
const affiliate = await mockGetAffiliate();

// AFTER (real API)
import { orpc } from "@/lib/orpc-client";
const affiliate = await orpc.users.affiliate.status.query();
```

**Note:** Phase 7 implemented Rewardful sync for admin. User-facing affiliate dashboard is **deferred to post-MVP** per Phase 7 lessons. For MVP, show minimal status or "Coming Soon" state.

### 0.3: Replace Subscription Banner Mock

**File:** [`apps/web/components/subscription-status-banner.tsx`](apps/web/components/subscription-status-banner.tsx)**Backend endpoint exists:** User subscription status available via session or dedicated query**Pattern:** Use Better-Auth session to check purchase status

### 0.4: Replace Community Mock

**Files:**

- [`apps/web/modules/saas/community/components/community-hub.tsx`](apps/web/modules/saas/community/components/community-hub.tsx)
- [`apps/web/modules/saas/community/components/announcement-card.tsx`](apps/web/modules/saas/community/components/announcement-card.tsx)

**Backend endpoint exists:** [`packages/api/modules/community/procedures/announcements/list.ts`](packages/api/modules/community/procedures/announcements/list.ts)**Keep:** `formatRelativeDate` utility function (not mock data, just helper)

### 0.5: Replace Category Labels Mock

**File:** [`apps/web/modules/saas/content/lib/category-labels.ts`](apps/web/modules/saas/content/lib/category-labels.ts)**Source:** Import from database or calculate from video list response

### 0.6: Delete Mock Files

After all replacements:

```bash
rm apps/web/lib/mock-api.ts
rm apps/web/lib/mock-data.ts
rm apps/web/app/(saas)/app/test-mock/page.tsx  # Test page
```

**Verify:**

```bash
grep -r "from.*mock-api" apps/web/
grep -r "from.*mock-data" apps/web/
# Should return 0 results
```

---

## Section 1: Per-Procedure Testing (4 hours)

Test all procedures individually using Playwright or manual browser testing.

### 1.1: Phase 1 Procedures (30 min)

**admin.users.impersonate** ([`packages/api/modules/admin/procedures/users/impersonate.ts`](packages/api/modules/admin/procedures/users/impersonate.ts)):

- [ ] Super admin can impersonate → gets token
- [ ] Non-super admin cannot → 403
- [ ] Invalid userId → 404
- [ ] Audit log created
- [ ] Can visit `/app/content` as impersonated user
- [ ] Exit impersonation works

### 1.2: Phase 3 Procedures (1 hour)

**content.videos.list** ([`packages/api/modules/content/procedures/videos/list.ts`](packages/api/modules/content/procedures/videos/list.ts)):

- [ ] Returns all published videos
- [ ] Filter by category works
- [ ] Search by title works
- [ ] Only published videos returned
- [ ] Sorted correctly

**community.announcements.list** ([`packages/api/modules/community/procedures/announcements/list.ts`](packages/api/modules/community/procedures/announcements/list.ts)):

- [ ] Returns published announcements
- [ ] Expired announcements excluded
- [ ] Sorted by publishedAt desc

**users.affiliate.status** ([`packages/api/modules/users/procedures/affiliate/status.ts`](packages/api/modules/users/procedures/affiliate/status.ts)):

- [ ] Returns `hasAffiliate: false` if no affiliate
- [ ] Returns affiliate data if exists

### 1.3: Phase 4 Procedures (1 hour)

**Grant/Revoke Access** ([`packages/api/modules/admin/procedures/users/`](packages/api/modules/admin/procedures/users/)):

- [ ] Grant creates manual-override Purchase
- [ ] Revoke deletes Purchase
- [ ] Discord roles update (if connected)
- [ ] Audit logs created
- [ ] Notifications created
- [ ] User access changes immediately

**Add User** ([`packages/api/modules/admin/procedures/users/add-user.ts`](packages/api/modules/admin/procedures/users/add-user.ts)):

- [ ] Creates User record
- [ ] Sends verification email
- [ ] Error if email exists

**Assign Role** ([`packages/api/modules/admin/procedures/users/assign-role.ts`](packages/api/modules/admin/procedures/users/assign-role.ts)):

- [ ] Updates User.role
- [ ] Audit log created

### 1.4: Phase 5 Procedures (1 hour)

**Subscription Management** ([`packages/api/modules/admin/procedures/subscriptions/`](packages/api/modules/admin/procedures/subscriptions/)):

- [ ] Cancel subscription works
- [ ] Apply coupon works
- [ ] Apply credit creates negative balance
- [ ] Change plan updates Stripe + database
- [ ] Extend trial updates both systems
- [ ] Overview returns enriched data
- [ ] Customer portal URL generated

### 1.5: Phase 6 Procedures (30 min)

**Admin Content** ([`packages/api/modules/admin/procedures/`](packages/api/modules/admin/procedures/)):

- [ ] Announcements CRUD works
- [ ] Notifications send/list/mark read works
- [ ] Audit log list filters work
- [ ] Pagination works

### 1.6: Phase 7 Procedures (30 min)

**Rewardful Sync** ([`packages/api/modules/admin/procedures/rewardful/sync.ts`](packages/api/modules/admin/procedures/rewardful/sync.ts)):

- [ ] First call fetches from API
- [ ] Cache works (5 min TTL)
- [ ] Force refresh bypasses cache
- [ ] Comparison categorizes correctly
- [ ] Handles API errors gracefully

---

## Section 2: Integration Testing (2 hours)

### 2.1: Grant Access → User Gets Access (30 min)

**Test flow:**

1. Admin grants access to test user
2. Verify Purchase created in Prisma Studio
3. Test user logs in
4. Navigate to `/app/content`
5. Can see content library
6. If Discord connected: verify role granted

### 2.2: Revoke Access → User Loses Access (30 min)

**Test flow:**

1. User has manual-override Purchase
2. Admin revokes access
3. Test user refreshes page
4. Blocked from `/app/content`

### 2.3: New User Subscription → Discord Access (45 min)

**Test complete flow:**

1. New user completes Stripe checkout
2. Webhook fires → Purchase created
3. Redirect to `/onboarding`
4. Step 2: Connect Discord OAuth
5. User added to server + role granted
6. Complete onboarding → `/app/community`
7. Shows "Connected as [username]"

### 2.4: Payment Failure → Grace Period (15 min)

**Test flow** (manual using Stripe Dashboard or CLI):

1. Trigger `invoice.payment_failed`
2. Verify Purchase.status = "grace_period"
3. Verify email sent
4. Verify Discord role changed
5. Verify notification created

---

## Section 3: Stripe Webhook Testing (1 hour)

### 3.1: Setup Stripe CLI

Terminal 1: Dev server (`pnpm dev`)Terminal 2: Stripe CLI forwarding

```bash
stripe listen --forward-to localhost:3000/api/webhooks/payments
```



### 3.2: Test Events

**Test each:**

- `invoice.paid` → Purchase active, Discord role granted
- `invoice.payment_failed` → Grace period starts
- `customer.subscription.deleted` → Purchase canceled

**Verify:**

- [ ] WebhookEvent created (idempotency)
- [ ] Duplicate webhooks ignored
- [ ] Discord integration works
- [ ] Emails sent

### 3.3: Test Signature Validation

Send invalid signature → should return 400---

## Section 4: Discord Integration Testing (1 hour)

### 4.1: OAuth Connection (15 min)

**Test:**

- Onboarding Step 2 OAuth flow
- Verify discordId and username saved
- User added to server

### 4.2: Role Management (30 min)

**Test:**

- Active subscription → "Active Member" role
- Payment fails → "Grace Period" role
- Subscription cancels → role changes
- Admin grant access → role granted

### 4.3: Error Handling (15 min)

**Test:** Discord bot offline scenario**Expected:** Purchase still created, error logged---

## Section 5: Error Handling & Edge Cases (1 hour)

### 5.1: Invalid Input Validation (15 min)

Test procedures with:

- Missing required fields → 400
- Invalid email formats → 400
- Invalid enum values → 400

### 5.2: External Service Failures (30 min)

**Test:**

- Stripe API down → graceful error
- Discord bot offline → operation continues
- Rewardful API error → cached data returned

### 5.3: Transaction Rollbacks (15 min)

Verify database transactions rollback on errors---

## Section 6: Performance & Database (1 hour)

### 6.1: Check for N+1 Queries (30 min)

Enable query logging in [`packages/database/client.ts`](packages/database/client.ts):

```typescript
const db = new PrismaClient({ log: ["query"] });
```

**Test these procedures:**

- `admin.users.list` (should use `include`)
- `admin.audit.list` (should join efficiently)
- `content.videos.list`

**Verify:** No N+1 patterns

### 6.2: Slow Query Detection (30 min)

Flag queries >500ms with realistic data:

- 100+ users
- 1000+ audit logs
- 50+ videos

**If slow:** Add indexes, optimize queries---

## Section 7: Frontend Compatibility Testing (1 hour)

### 7.1: Admin Dashboard (30 min)

**Navigate and test:**

- `/admin` - Dashboard loads
- `/admin/users` - User list loads, grant/revoke works
- `/admin/users/[id]` - User detail loads
- `/admin/announcements` - CRUD works
- `/admin/rewardful` - Sync works

**Verify:**

- No console errors
- No TypeScript errors
- All dialogs open/close
- Success toasts appear
- Real data displays (matches Prisma Studio)

### 7.2: User Pages (30 min)

**Navigate and test:**

- `/app/content` - Library loads, videos display
- `/app/community` - Hub loads, announcements display
- `/app/affiliate` - Status shows (or Coming Soon)
- `/app/account` - Settings load

**Verify:**

- No console errors
- No "mock mode" messages
- Real data displays
- Search/filters work

---

## Section 8: Create Test Report & Final Verification (1 hour)

### 8.1: Document Test Results (30 min)

Create [`TEST-REPORT.md`](TEST-REPORT.md) with:

- Summary (procedures tested, passed/failed)
- Per-procedure results
- Integration test results
- Performance notes
- Known issues (if any)
- Production readiness assessment

### 8.2: Final Mock Elimination Verification (30 min)

**Run these commands:**

```bash
# Search for mock files
find apps/web -name "mock-*.ts" -type f
# Should return 0 files

# Search for mock imports
grep -r "from.*mock-" apps/web/
grep -r "getMock" apps/web/
# Should return 0 results
```

**Verify in Prisma Studio:**

- Admin dashboard data matches database exactly
- Subscription data matches Stripe
- Announcements match database
- Video list matches database

**Production readiness checklist:**

- [ ] All mock files deleted
- [ ] All procedures tested
- [ ] Integration workflows pass
- [ ] Stripe webhooks work
- [ ] Discord integration works
- [ ] Error handling graceful
- [ ] Performance acceptable
- [ ] Frontend compatibility verified
- [ ] Test report created

---

## Files to Create/Modify

**Create:**

- `TEST-REPORT.md` - Comprehensive test results

**Modify (Section 0 - Mock Elimination):**

- All affiliate component files (replace mock with real API)
- `subscription-status-banner.tsx` (use session data)
- `community-hub.tsx` (use ORPC)
- `category-labels.ts` (derive from API)

**Delete:**

- `apps/web/lib/mock-api.ts`
- `apps/web/lib/mock-data.ts`
- `apps/web/app/(saas)/app/test-mock/page.tsx`

**Modify (Testing Infrastructure):**

- `packages/database/client.ts` (temporarily enable query logging)

---

## Success Criteria

**Phase 8 complete when:**

- ✅ ALL frontend mock data eliminated (critical blocker)
- ✅ All 21+ procedures tested individually
- ✅ 4+ integration workflows pass
- ✅ Stripe webhooks tested with CLI
- ✅ Discord integration works end-to-end
- ✅ Error handling verified
- ✅ Performance acceptable (no N+1 queries)
- ✅ Frontend unchanged (no breaking changes)
- ✅ Test report created
- ✅ Critical bugs fixed
- ✅ **READY FOR ALPHA USERS** 🎉

---

## Timeline Estimate

- Section 0 (Mock Elimination): 4-6 hours
- Section 1 (Per-Procedure): 4 hours
- Section 2 (Integration): 2 hours  
- Section 3 (Stripe Webhooks): 1 hour
- Section 4 (Discord): 1 hour
- Section 5 (Error Handling): 1 hour
- Section 6 (Performance): 1 hour
- Section 7 (Frontend): 1 hour
- Section 8 (Report): 1 hour

**Total:** 16-18 hours (worth every minute to catch bugs before production!)---

## Critical Notes

1. **Section 0 is MANDATORY** - Cannot skip mock elimination
2. Test methodically - don't rush
3. Document ALL findings in test report
4. Fix critical bugs immediately
5. Minor bugs can be documented for post-launch
6. Use Prisma Studio to verify database changes