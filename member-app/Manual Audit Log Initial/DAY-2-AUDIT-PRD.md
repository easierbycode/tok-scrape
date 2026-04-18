# DAY 2 CODEBASE AUDIT - REQUIREMENTS

**Project:** Lifepreneur V1 Rebuild
**Phase:** Understanding Supastarter architecture before building features
**Duration:** 3-4 hours
**Date:** December 2, 2025

---

## 🎯 AUDIT OBJECTIVES

By end of Day 2, you must understand:

1. **How proxy.ts protects routes** - So you can add subscription checks
2. **How Stripe webhooks work** - So you can add grace period + account creation
3. **How Supabase clients work** - So you can fetch subscription data correctly
4. **How RLS policies work** - So you can gate content at database level
5. **Auth flow patterns** - So you can build purchase-first onboarding
6. **Dashboard structure** - So you can add Content Library page
7. **What to delete** - So you clean up unused features

---

## 🔐 PROXY.TS REQUIREMENTS

### Current Behavior (What Supastarter Does)
- Checks if user has session cookie (logged in)
- Redirects to `/auth/login` if not logged in
- Allows ALL logged-in users to access `/app` routes

### Required Behavior (What YOU Need)

#### Route Access Rules:

**PUBLIC (No auth required):**
- Landing pages (`/`)
- Pricing page (`/pricing`)
- Public resources

**LOGIN REQUIRED (Session only):**
- Account settings (`/app/settings`)
- Billing/upgrade page (`/app/billing`)

**SUBSCRIPTION REQUIRED (Active subscription + login):**
- Content library (`/app/content`)
- Affiliate dashboard (`/app/affiliate`)
- Discord integration (`/app/discord`)

#### Subscription Status Logic:

User has access if **ANY** of these is true:
```
subscription_status = 'active' 
OR subscription_status = 'grace_period'
OR subscription_override = true
```

User DENIED access if:
```
subscription_status = 'none'
OR subscription_status = 'cancelled'
(unless subscription_override = true)
```

#### Redirect Behavior:

- No session → Redirect to `/auth/login?redirectTo={current_path}`
- Has session but no subscription → Redirect to `/app/billing?reason=subscription_required`
- Has active/grace_period subscription → Allow access
- Has subscription_override → Allow access (bypass subscription check)

---

## 🎯 PROXY.TS MODIFICATIONS NEEDED

### Step 1: Fetch User Subscription Data

Current proxy only checks session cookie. You need to:
1. Get user ID from session
2. Fetch user record from Supabase `users` table
3. Check `subscription_status` and `subscription_override` fields

### Step 2: Implement Route-Specific Checks

```typescript
// Pseudocode pattern you need:

if (pathname.startsWith("/app/content") || 
    pathname.startsWith("/app/affiliate") || 
    pathname.startsWith("/app/discord")) {
  
  // Fetch user data from Supabase
  const user = await fetchUserFromSupabase(userId);
  
  // Check subscription status
  const hasAccess = 
    user.subscription_status === 'active' ||
    user.subscription_status === 'grace_period' ||
    user.subscription_override === true;
  
  if (!hasAccess) {
    return NextResponse.redirect('/app/billing?reason=subscription_required');
  }
}

if (pathname.startsWith("/app/settings") || 
    pathname.startsWith("/app/billing")) {
  // Just check session (already done)
  // No subscription check needed
}
```

### Step 3: Handle Edge Cases

- Grace period users: Show banner "Payment failed - X days remaining"
- Subscription override users: Access everything without Stripe subscription
- Newly purchased: Handle webhook delay (show "Processing..." screen)

---

## 💳 STRIPE WEBHOOK REQUIREMENTS

### Events You Must Handle:

**1. `checkout.session.completed`**
- Create user account in Supabase
- Set subscription_status = 'active'
- Send magic link email via Resend
- Store Stripe customer_id and subscription_id

**2. `invoice.payment_failed`**
- Set subscription_status = 'grace_period'
- Set grace_period_ends_at = now() + 3 days
- Send "Payment Failed" email via Resend
- Keep user access active during grace period

**3. `invoice.payment_succeeded`**
- Confirm subscription_status = 'active' (if was in grace period, restore)
- Update current_period_end timestamp
- Send "Payment Successful" email

**4. `customer.subscription.updated`**
- Sync subscription status changes
- Handle plan upgrades/downgrades
- Update current_period_end

**5. `customer.subscription.deleted`**
- Set subscription_status = 'cancelled'
- Trigger Discord role removal
- Send "Subscription Cancelled" email
- User loses access immediately

### Webhook Security:

Must verify webhook signature using Stripe's verification:
```typescript
const sig = headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
// Never trust webhook without signature verification
```

### Account Creation Flow:

When `checkout.session.completed` fires:
1. Extract email from Stripe session
2. Create user in Supabase `auth.users`
3. Create record in `users` table with subscription_status = 'active'
4. Create record in `subscriptions` table
5. Send magic link email via Resend
6. User clicks link → sets password → lands on onboarding

---

## 🗄️ SUPABASE CLIENT REQUIREMENTS

### Three Client Types:

**1. Client-side (`@/lib/supabase/client.ts`):**
- Use in: React components, client-side logic
- Example: Fetching user profile data in dashboard

**2. Server-side (`@/lib/supabase/server.ts`):**
- Use in: Server Components, API routes
- Example: Fetching content videos in /app/content page

**3. Proxy-side (`@/lib/supabase/middleware.ts` or similar):**
- Use in: proxy.ts for route protection
- Example: Checking subscription_status before allowing access

### What You Need to Learn:

- How to import each client type
- How to fetch user data in each context
- How to check subscription_status from proxy.ts
- Session cookie handling

---

## 🔒 RLS POLICY REQUIREMENTS

### Content Videos Table:

Only accessible if user has active subscription:

```sql
CREATE POLICY "Content requires active subscription" ON content_videos
  FOR SELECT USING (
    published = true AND (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND (
          users.subscription_status = 'active'
          OR users.subscription_status = 'grace_period'
          OR users.subscription_override = true
        )
      )
    )
  );
```

### Affiliates Table:

Only accessible if user has active subscription:

```sql
CREATE POLICY "Affiliates require subscription" ON affiliates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.subscription_status = 'active'
        OR users.subscription_override = true
      )
    )
  );
```

### Users Table:

Users can only read/update their own data:

```sql
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);
```

### Admin Tables:

Only accessible to admin roles:

```sql
CREATE POLICY "Admin table for admins only" ON admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
```

---

## 🧭 AUTH FLOW REQUIREMENTS

### Current Supastarter Flow (to disable):

1. User can signup freely at `/auth/signup`
2. Creates account without payment
3. Logs in and accesses dashboard

### Required Flow (purchase-first):

1. User visits `/pricing`
2. Clicks "Subscribe" → Stripe Checkout
3. Payment succeeds → Webhook creates account
4. User receives magic link email
5. User sets password → Onboarding flow
6. User lands on `/app/content`

### What You Need to Understand:

- How current signup form works (so you can disable it)
- How login form works (so you can reuse for onboarding)
- Where redirects happen after auth
- Form validation patterns to copy

---

## 📂 DASHBOARD STRUCTURE REQUIREMENTS

### Current Structure (to modify):

- `/app` - Start/home page → DELETE, replace with Content Library
- `/app/chatbot` - AI Chatbot → DELETE entirely
- `/app/settings` - Account settings → KEEP

### Required Structure:

- `/app/content` - Content Library (Netflix-style) → BUILD THIS
- `/app/affiliate` - Affiliate Dashboard → BUILD THIS
- `/app/settings` - Account Settings → KEEP & rebrand
- `/app/billing` - Subscription management → KEEP & rebrand

### Navigation Items:

**Sidebar should have:**
- Content (icon: video/play)
- Affiliate (icon: link/share)
- Settings (icon: gear)
- Billing (icon: credit card)

**Remove from sidebar:**
- Start/Home
- Chatbot
- Organizations

---

## 🗑️ FEATURES TO DELETE

### Definitely Delete:

1. **Organizations feature** - Entire section
   - Multi-tenant functionality you don't need
   - Delete: `/app/organizations`, `/app/new-organization`, etc.
   
2. **AI Chatbot** - Not in PRD
   - Delete: `/app/chatbot`, related components

3. **Blog/Changelog** - Marketing fluff
   - Delete: `/blog`, `/changelog` if they exist

4. **Demo pages** - Example content
   - Delete any "starter" or "example" pages

### Check Before Deleting:

Ask Cursor: "If I delete [feature], will it break authentication, billing, or core dashboard?"

---

## 📝 DELIVERABLE: SUPASTARTER-MAP.md

After audit, create documentation with:

### Section 1: Proxy.ts Pattern
```markdown
## Proxy.ts Pattern

**How it checks auth:**
[paste the pattern]

**Where to add subscription check:**
[specific line/section]

**How to fetch user data:**
[code snippet]

**Redirect logic:**
[current behavior → required behavior]
```

### Section 2: Webhook Handler
```markdown
## Webhook Handler

**Signature verification pattern:**
[paste exact code to copy]

**Events currently handled:**
[list them]

**Where to add grace period logic:**
[specific section with line numbers]

**Account creation flow:**
[step-by-step from webhook to Supabase]
```

### Section 3: Supabase Clients
```markdown
## Supabase Client Usage

**Client-side:** Use when [explain]
Import: [code]

**Server-side:** Use when [explain]
Import: [code]

**Proxy:** Use when [explain]
Import: [code]
```

### Section 4: RLS Policies
```markdown
## RLS Policy Patterns

**Subscription-gated content:**
[paste SQL pattern]

**Admin-only access:**
[paste SQL pattern]

**User-specific data:**
[paste SQL pattern]
```

### Section 5: What Was Deleted
```markdown
## Deleted Features

**Organizations** - [why safe to delete]
**Chatbot** - [why safe to delete]
**Blog** - [why safe to delete]

**Verified no breaking changes:**
- Authentication: ✅ Still works
- Billing: ✅ Still works
- Dashboard: ✅ Still works
```

---

## 🎯 SUCCESS CRITERIA

You're done with Day 2 audit when you can answer:

1. **Where do I add subscription checks?** → In proxy.ts, lines X-Y
2. **How do I fetch user subscription data?** → Using [specific Supabase client]
3. **How do I create a subscription-gated RLS policy?** → [SQL pattern]
4. **Where does account creation happen?** → Stripe webhook handler
5. **How do I add a new protected route?** → [dashboard pattern + proxy check]
6. **What did I delete and why?** → [list with reasons]

---

## ⏰ TIME BREAKDOWN

- Proxy.ts audit: 30 min
- Stripe webhook audit: 45 min
- Supabase patterns audit: 30 min
- RLS policies audit: 45 min
- Auth flows audit: 20 min
- Dashboard structure audit: 20 min
- Delete unused features: 30 min

**Total: 3-4 hours**

---

## 🚨 RED FLAGS

Stop and ask for help if:

- Cursor's explanations don't make sense after 2 attempts
- You can't find RLS policy examples
- Stripe webhook is way more complex than expected
- You're 5 hours in and still confused about proxy.ts
- You accidentally break authentication

---

## 💡 CURSOR PROMPTING TIPS

### When Cursor's Answer Is Too Complex:

**Bad response indicators:**
- Walls of code without explanation
- Technical jargon you don't understand
- "Just do X" without showing how

**Follow-up prompt:**
```
That explanation was too technical. Explain it like I'm learning:
1. What does this code actually DO in plain English?
2. Why does it work this way?
3. Show me one simple example
```

### When You Need Code Snippets:

**Ask for copy-paste ready code:**
```
Show me the exact code I need to:
1. Fetch user subscription_status in proxy.ts
2. Check if user has access (active OR grace_period OR override)
3. Redirect to /app/billing if no access

Format as copy-paste ready TypeScript.
```

### When Reviewing Patterns:

**Ask Cursor to annotate:**
```
@proxy.ts

Add inline comments explaining what each section does:
- What is getSessionCookie() checking?
- Why does it redirect to /auth/login?
- Where would I add a database query?

Annotate the actual code, don't rewrite it.
```

---

## 🔍 DEBUGGING TIPS

### If Proxy.ts Changes Break the Site:

1. **Check the error in terminal:**
   - Look for TypeScript errors
   - Look for import errors
   - Look for syntax errors

2. **Ask Cursor:**
   ```
   @proxy.ts
   
   I'm getting this error: [paste error]
   
   What did I break and how do I fix it?
   ```

3. **Revert if stuck:**
   ```bash
   git checkout proxy.ts
   # Start over with smaller changes
   ```

### If Supabase Queries Don't Work:

**Common issues:**
- Wrong client type (using client-side in server context)
- RLS blocking your query
- Wrong table/column name

**Ask Cursor:**
```
@[your file with the query]

This Supabase query isn't working: [paste query]
Error: [paste error]

1. Am I using the right Supabase client for this context?
2. Could RLS be blocking this?
3. Show me the corrected version
```

### If You Can't Find a File:

**Search strategy:**
```bash
# In terminal or Cursor:
find . -name "*webhook*" -type f
find . -name "*supabase*" -type f
find . -name "*middleware*" -type f
```

**Or ask Cursor:**
```
Where is the Stripe webhook handler located in this project? 
Search the codebase and tell me the exact file path.
```

---

## 📚 PATTERN LIBRARY (Copy These)

### Pattern 1: Checking Subscription in Proxy

```typescript
// Fetch user from Supabase
const supabase = createMiddlewareClient({ req });
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.redirect('/auth/login');
}

// Get subscription status
const { data: userData } = await supabase
  .from('users')
  .select('subscription_status, subscription_override')
  .eq('id', user.id)
  .single();

// Check access
const hasAccess = 
  userData.subscription_status === 'active' ||
  userData.subscription_status === 'grace_period' ||
  userData.subscription_override === true;

if (!hasAccess) {
  return NextResponse.redirect('/app/billing?reason=subscription_required');
}
```

### Pattern 2: Stripe Webhook Signature Verification

```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      // Handle account creation
      break;
    case 'invoice.payment_failed':
      // Handle grace period
      break;
    // etc.
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### Pattern 3: RLS Policy Template

```sql
-- Replace TABLE_NAME and conditions with your needs
CREATE POLICY "policy_name" ON TABLE_NAME
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (
        users.subscription_status = 'active'
        OR users.subscription_status = 'grace_period'
        OR users.subscription_override = true
      )
    )
  );
```

### Pattern 4: Supabase Client Import

```typescript
// Client-side (React components)
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
const supabase = createClientComponentClient();

// Server-side (Server Components, API routes)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
const supabase = createServerComponentClient({ cookies });

// Proxy (proxy.ts)
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
const supabase = createMiddlewareClient({ req, res });
```

---

## 🎯 DAILY CHECKPOINT QUESTIONS

Before ending your audit session, answer these:

**After Proxy.ts (30 min mark):**
- [ ] Can I explain what proxy.ts does in 3 sentences?
- [ ] Do I know where to add subscription checks?
- [ ] Do I understand how to fetch user data here?

**After Webhooks (1.5 hour mark):**
- [ ] Can I list the 5 events I need to handle?
- [ ] Do I know where account creation happens?
- [ ] Do I know where to add grace period logic?

**After Supabase (2 hour mark):**
- [ ] Do I know which client to use in proxy.ts?
- [ ] Do I know which client to use in API routes?
- [ ] Do I know which client to use in components?

**After RLS (3 hour mark):**
- [ ] Can I write a basic RLS policy?
- [ ] Do I understand the subscription check pattern?
- [ ] Do I know how auth.uid() works?

**After Full Audit (4 hour mark):**
- [ ] Did I document everything in SUPASTARTER-MAP.md?
- [ ] Did I delete unused features safely?
- [ ] Am I ready to start building on Day 3?

If you answer "no" to any checkpoint questions, spend more time on that section.

---

## 🛠️ USEFUL CURSOR COMMANDS

### Understanding Code Flow:
```
@proxy.ts

Trace the flow: When a user visits /app/content, what happens step-by-step from this file? Number each step.
```

### Finding Dependencies:
```
@proxy.ts

What other files does this import? What do each of those files do?
```

### Security Review:
```
@proxy.ts @apps/web/app/api/webhooks/stripe/route.ts

Review these files for security issues:
1. Are there any bypass vulnerabilities?
2. Is data validated properly?
3. What could go wrong?
```

---

**This mini-PRD gives you everything you need to systematically audit the codebase with Cursor, understanding each component well enough to modify it for your requirements.**
