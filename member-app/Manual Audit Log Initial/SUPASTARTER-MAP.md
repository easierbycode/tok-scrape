# Supastarter Exploration - Day 1

## ✅ Completed Initial Exploration

### Onboarding Flow
- Single page: Name (prefilled) + Avatar upload (optional)
- Lands on: `/app` (Personal Account - Free plan)

### Navigation Structure

**Left Sidebar:**
- **Start** (`/app`) - DELETE, replace with Content Library
- **AI Chatbot** (`/app/chatbot`) - DELETE entire feature
- **Account Settings** (`/app/settings/*`) - KEEP structure, rebrand

**User Menu (bottom left):**
- Color Mode (light/dark/system) - KEEP
- Account Settings - KEEP
- Documentation - REPURPOSE for TikTok Agency Info
- Home (marketing page) - KEEP (maintains session)
- Logout - KEEP

### Features Analysis

**DELETE Completely:**
- [ ] Organizations feature (entire section)
- [ ] AI Chatbot (not in PRD)
- [ ] Start/Home dashboard (replace with Content Library)

**KEEP & Rebrand:**
- [x] Account Settings structure (all pages usable)
- [x] User profile menu
- [x] Color mode toggle
- [x] Documentation link (repurpose)

**REPLACE:**
- [ ] `/app` dashboard → Content Library (Netflix-style)
- [ ] "Start" nav item → "Content" or "Library"

### Known Issues (Expected)
- Source map warnings (Turbopack dev mode - ignore)
- Fetch failed on payments (Stripe not configured yet - expected)
- These won't affect our rebuild

## Paywall Testing (Day 1)

**Test:** Manually added 'pro' subscription to database
**Finding:** No demo features are actually gated behind paywall

**What Supastarter Provides:**
- Purchase tracking infrastructure
- Plan detection via productId
- Billing page UI
- Stripe integration foundation

**What We Need to Build:**
- Middleware to check subscription status
- RLS policies to gate content access
- Grace period handling (3 days)
- subscription_override for admin accounts

**Pricing Tiers (from landing page):**
- Free: Limited support
- Pro (Monthly/Yearly): Full support, 7-day trial
- Lifetime: Extended support
- Enterprise: Unlimited projects, extended support

**Our Implementation:**
- Single tier: $99/month or $1000/year
- Focus on subscription gating, not multiple tiers
- Grace period is our unique feature
---

## Next Steps for Tomorrow (Day 2)

### Morning: Code Structure Audit
1. Understand auth patterns
2. Map route protection
3. Find Stripe webhook handlers
4. Review database structure

### Afternoon: Start Cleanup
1. Delete organizations feature
2. Delete AI chatbot
3. Remove marketing blog/changelog
4. Deploy cleaned version to Vercel

DAY 2 COMPLETED (December 1, 2025)
Morning Sessions: Visual Rebrand (45 minutes)
NOTE: Deviated from original Day 2 plan (codebase audit) to tackle visual rebrand first. Will return to proper audit tomorrow.
Session 1: Config & App Name Audit (15 min)
Completed:

 Identified 37 instances of "Supastarter" across 15 files
 Created comprehensive find/replace checklist
 Mapped critical configuration files
 Executed global find/replace: "Supastarter" → "LifePreneur"
 Executed global find/replace: "Acme" → "LifePreneur"

Files Updated:

config/index.ts - Changed appName to "LifePreneur"
package.json - Changed name to "lifepreneur-v1"
All user-facing text across components
Email templates (translation files)
Footer components
User menu links

Session 2: Logo & Favicon Replacement (15 min)
Problem Solved: Supastarter rocket SVG was embedded in Logo.tsx component
Completed:

 Identified the inline SVG rocket code in apps/web/modules/shared/components/Logo.tsx
 Replaced with Next.js Image component pointing to PNG logo
 Created LP logo file: apps/web/public/images/lp-logo.png
 Updated favicon: apps/web/app/icon.png (512x512px)
 Updated legacy favicon: apps/web/app/favicon.ico
 Logo now displays correctly across entire site

Technical Learning:

Canva SVG exports are actually PNG embedded in SVG wrapper (not true vector)
Using Next.js Image component with PNG is cleaner than inline SVG for raster logos
Fast Refresh can cache SVG components aggressively

Session 3: Color System Update (15 min)
Tech Stack Note: Using Tailwind CSS v4 (no tailwind.config.ts)
Completed:

 Located color definitions: packages/tailwind-config/theme.css
 Updated primary color: #4e6df5 → #dd6220 (Lifepreneur orange)
 Updated secondary color: #292b35 → #f27d09 (lighter orange)
 Updated ring/focus colors to match brand
 Updated accent color to light orange tint: #fde9dd
 Updated highlight color to match primary
 Configured dark mode colors (lighter orange for visibility)
 Tested across site - all buttons/links now orange

Brand Colors Applied:

Primary: #dd6220 (orange)
Secondary: #f27d09 (lighter orange)
Focus Ring: #dd6220
Accent: #fde9dd (light orange tint)

Files Modified:

packages/tailwind-config/theme.css - Updated CSS variables for light/dark modes

Visual Rebrand Status

✅ Logo: Complete (LP rocket displaying)
✅ Colors: Complete (orange brand applied)
✅ Text: Complete (all "Supastarter"/"Acme" replaced)
⚠️ Polish: Deferred (will refine as needed during feature development)


🎯 PENDING: PROPER DAY 2 CODEBASE AUDIT
Still Need to Complete:
Critical Files to Study (from PRD):

 /middleware.ts - Route protection patterns
 /app/api/webhooks/stripe/route.ts - Subscription webhook handling
 /lib/supabase/ - RLS policy examples
 /app/(auth)/ - Authentication flows
 /app/dashboard/ - Dashboard structure

Features to Delete:

 Organizations feature (entire section)
 AI Chatbot (not in PRD)
 Start/Home dashboard placeholder
 Example blog features
 Marketing changelog

Documentation to Create:

 Middleware patterns explained
 Webhook flow diagram
 Authentication flow notes
 Database schema comparison (Supastarter vs. our custom needs)


📅 NEXT SESSION PLAN
Day 3: Complete Proper Codebase Audit
Priority: Get back on track with PRD Day 2 work

Middleware Study - Understand route protection
Webhook Analysis - Map Stripe integration points
Auth Flow Review - Document authentication patterns
Database Structure - Compare Supastarter vs. our PRD schema
Delete Unused Features - Clean up organizations, chatbot, etc.

Technical Debt Notes:

Logo works but may need optimization later
Color system functional but could use full scale (50-900)
Text rebrand complete but some copy may need polish
Visual changes tested on landing/dashboard only (need full site check)


📊 OVERALL PROJECT STATUS
Week 1 Progress (PRD Timeline):

Day 1: ✅ Supastarter Setup (COMPLETE)
Day 2: ⚠️ Codebase Audit (INCOMPLETE - did visual rebrand instead)
Day 3-4: Database Schema Implementation (UPCOMING)
Day 5: Stripe Webhook Migration (UPCOMING)

Deviation from Plan:
Jumped ahead to visual rebrand (unscheduled) but still need to complete the foundational codebase understanding before building features.
Rationale: Visual rebrand allows development against branded interface, but understanding the architecture is critical for Week 2 feature work.
Adjustment: Will complete proper audit before starting database work.