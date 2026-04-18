# DEV MODE CHANGES - COMPLETE DOCUMENTATION

**Created:** December 5, 2025  
**Updated:** December 5, 2025  
**Purpose:** Track ALL temporary dev shortcuts that MUST be removed before production  
**Revert Date:** Week 4, Day 20 (Backend Connection)

---

## ⚠️ CRITICAL: THESE ARE SECURITY HOLES

The following changes were made to allow frontend development in Weeks 1-3 without a connected backend. **ALL of these MUST be reverted when connecting real authentication in Week 4.**

---

## 📋 SUMMARY OF ALL CHANGES

### Files Modified: 12
### Files Deleted: 1
### Files Cleaned: 3

**Total Auth Checks Disabled:** 8 separate session/auth checks across the application

---

## 🔓 DETAILED CHANGES

### 1. **Middleware - proxy.ts**

**File:** `apps/web/proxy.ts`  
**Lines:** 22-40  
**Type:** Auth check disabled

**Change:** Commented out session cookie check in middleware

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
// Check for dev mock session cookie
const devSessionCookie = req.cookies.get("dev-mock-session");
const hasDevSession = devSessionCookie !== undefined;

// Allow access if either real session OR dev session exists
if (!sessionCookie && !hasDevSession) {
	return NextResponse.redirect(
		new URL(
			withQuery("/auth/login", {
				redirectTo: pathname,
			}),
			origin,
		),
	);
}
*/
```

**⚠️ SECURITY RISK:** Anyone can access `/app/*` routes without authentication

**REVERT ACTION (Week 4):** Uncomment the entire block

---

### 2. **Parent SaaS Layout**

**File:** `apps/web/app/(saas)/layout.tsx`  
**Lines:** 22-35  
**Type:** Auth check disabled

**Change:** Commented out session check and added session guards to prefetch queries

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}
*/

// Only prefetch session data if we have a session
if (session) {
	await queryClient.prefetchQuery({
		queryKey: sessionQueryKey,
		queryFn: () => session,
	});
}

if (config.organizations.enable && session) {
	await queryClient.prefetchQuery({
		queryKey: organizationListQueryKey,
		queryFn: getOrganizationList,
	});
}

if (config.users.enableBilling && session) {
	await queryClient.prefetchQuery(
		orpc.payments.listPurchases.queryOptions({
			input: {},
		}),
	);
}
```

**⚠️ SECURITY RISK:** Parent layout allows access without session

**REVERT ACTION (Week 4):** 
- Uncomment the session redirect check
- Remove `&& session` conditions from prefetch queries (session will always exist)

---

### 3. **App Layout**

**File:** `apps/web/app/(saas)/app/layout.tsx`  
**Lines:** 15-60  
**Type:** Auth check disabled

**Change:** Commented out session and onboarding checks, wrapped org/billing logic

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}

if (config.users.enableOnboarding && !session.user.onboardingComplete) {
	redirect("/onboarding");
}
*/

// Only run organization/billing checks if we have a session
if (session) {
	const organizations = await getOrganizationList();
	// ... rest of logic
}
```

**⚠️ SECURITY RISK:** App routes accessible without session or onboarding

**REVERT ACTION (Week 4):**
- Uncomment session and onboarding checks
- Move `getOrganizationList()` back outside the if block

---

### 4. **Settings Layout**

**File:** `apps/web/app/(saas)/app/(account)/settings/layout.tsx`  
**Lines:** 20-30  
**Type:** Auth check disabled

**Change:** Commented out session check, added fallback for user data

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}
*/

// Use mock user data for settings menu when no session exists
const userName = session?.user.name ?? "Dev User";
const userImage = session?.user.image;
```

**⚠️ SECURITY RISK:** Settings accessible without authentication

**REVERT ACTION (Week 4):**
- Uncomment session check
- Remove fallback values (use `session.user.name` directly)

---

### 5. **Admin Layout**

**File:** `apps/web/app/(saas)/app/(account)/admin/layout.tsx`  
**Lines:** 16-22  
**Type:** Auth check AND role check disabled

**Change:** Commented out both session and admin role validation

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}

if (session.user?.role !== "admin") {
	redirect("/app");
}
*/
```

**⚠️ SECURITY RISK:** Anyone can access admin pages

**REVERT ACTION (Week 4):**
- Uncomment both checks
- Consider checking AdminUser table instead of user.role

---

### 6. **Settings - General Page**

**File:** `apps/web/app/(saas)/app/(account)/settings/general/page.tsx`  
**Lines:** 22-24  
**Type:** Page-level auth check disabled

**Change:** Commented out session check

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}
*/
```

**⚠️ SECURITY RISK:** General settings page accessible without auth

**REVERT ACTION (Week 4):** Uncomment the session check

---

### 7. **Settings - Security Page**

**File:** `apps/web/app/(saas)/app/(account)/settings/security/page.tsx`  
**Lines:** 30-52  
**Type:** Page-level auth check disabled + data guards added

**Change:** Commented out session check, added conditional data fetching

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}
*/

// Only fetch user accounts if we have a session
const userAccounts = session ? await getUserAccounts() : [];

// ... rest of code

if (session) {
	await queryClient.prefetchQuery({
		queryKey: userAccountQueryKey,
		queryFn: () => getUserAccounts(),
	});

	if (config.auth.enablePasskeys) {
		await queryClient.prefetchQuery({
			queryKey: userPasskeyQueryKey,
			queryFn: () => getUserPasskeys(),
		});
	}
}
```

**⚠️ SECURITY RISK:** Security settings accessible without auth

**REVERT ACTION (Week 4):**
- Uncomment session check
- Remove conditional fetching (always fetch when session exists)

---

### 8. **Settings - Danger Zone Page**

**File:** `apps/web/app/(saas)/app/(account)/settings/danger-zone/page.tsx`  
**Lines:** 18-20  
**Type:** Page-level auth check disabled

**Change:** Commented out session check

```typescript
// 🔧 AUTH CHECK DISABLED FOR WEEKS 1-3 DEVELOPMENT
// Uncomment this block when ready to implement real auth in Week 4
/*
if (!session) {
	redirect("/auth/login");
}
*/
```

**⚠️ SECURITY RISK:** Account deletion page accessible without auth

**REVERT ACTION (Week 4):** Uncomment the session check

---

### 9. **Dev Login Page (CREATED)**

**File:** `apps/web/app/auth/dev-login/page.tsx`  
**Type:** Temporary dev page - DELETE IN WEEK 4

**Purpose:** Allows selecting admin or regular user, stores mock session in localStorage

```typescript
const handleLogin = (userType: "admin" | "regular") => {
  const user = mockUsers[userType];
  
  // Store mock session in localStorage
  localStorage.setItem("dev-mock-session", JSON.stringify({
    user,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }));
  
  router.push("/app");
};
```

**⚠️ SECURITY RISK:** Allows anyone to become admin without credentials

**REVERT ACTION (Week 4):** Delete entire file and folder

---

### 10. **Dev Logout Page (CREATED)**

**File:** `apps/web/app/auth/dev-logout/page.tsx`  
**Type:** Temporary dev page - DELETE IN WEEK 4

**Purpose:** Clears localStorage and redirects to dev-login

```typescript
useEffect(() => {
  localStorage.removeItem("dev-mock-session");
  router.push("/auth/dev-login");
}, [router]);
```

**REVERT ACTION (Week 4):** Delete entire file and folder

---

### 11. **NavBar Component (MODIFIED)**

**File:** `apps/web/modules/saas/shared/components/NavBar.tsx`  
**Lines:** 34-53  
**Type:** Added localStorage session reading

**Change:** Added dev session support that reads from localStorage

```typescript
// Dev session support - reads from localStorage
const [devUser, setDevUser] = useState<any>(null);

useEffect(() => {
	if (typeof window !== "undefined") {
		const devSession = localStorage.getItem("dev-mock-session");
		if (devSession) {
			try {
				const session = JSON.parse(devSession);
				setDevUser(session.user);
			} catch (e) {
				// Silent fail - invalid session format
			}
		}
	}
}, []);

const currentUser = user || devUser;

// Check for admin role
const isAdmin = currentUser?.role === "admin";
```

**⚠️ SECURITY RISK:** Admin status determined by client-side localStorage

**REVERT ACTION (Week 4):**
- Remove `devUser` state and useEffect
- Change `const currentUser = user || devUser;` to `const currentUser = user;`
- Change `const isAdmin = currentUser?.role === "admin";` to check AdminUser table

---

### 12. **Mock Data (MODIFIED)**

**File:** `apps/web/lib/mock-data.ts`  
**Lines:** 27-64  
**Type:** Added mockUsers export

**Change:** Added two mock users with different roles

```typescript
export const mockUsers = {
  admin: {
    id: "admin-user-123",
    email: "kyle@lifepreneur.com",
    name: "Kyle (Admin)",
    role: "admin",  // ← Admin role
    // ... rest of fields
  },
  regular: {
    id: "regular-user-123",
    email: "member@lifepreneur.com",
    name: "Regular Member",
    role: null,  // ← No admin role
    // ... rest of fields
  },
};
```

**⚠️ SECURITY RISK:** Hardcoded admin credentials in client-side code

**REVERT ACTION (Week 4):** Delete `mockUsers` export entirely (keep other mock data for demos)

---

### 13. **API Route (DELETED)**

**File:** `apps/web/app/api/dev-login/route.ts`  
**Type:** DELETED - was unused

**Note:** This file was created but never used, so it was deleted during cleanup

---

### 14. **NavBar Console.log (CLEANED)**

**File:** `apps/web/modules/saas/shared/components/NavBar.tsx`  
**Line:** 44  
**Type:** Code cleanup

**Change:** Removed console.log statement from catch block

```typescript
// BEFORE:
catch (e) {
  console.log("Invalid dev session");
}

// AFTER:
catch (e) {
  // Silent fail - invalid session format
}
```

**Note:** This was just cleanup, not a security issue

---

### 15. **UserMenu Component (MODIFIED)**

**File:** `apps/web/modules/saas/shared/components/UserMenu.tsx`  
**Lines:** 34-50  
**Type:** Added localStorage session reading  
**Date Added:** December 5, 2025

**Change:** Added dev session support to match NavBar's dev login functionality

```typescript
// 🆕 DEV: Get user from dev session if no real session
const [devUser, setDevUser] = useState<any>(null);

useEffect(() => {
	if (typeof window !== "undefined") {
		const devSession = localStorage.getItem("dev-mock-session");
		if (devSession) {
			try {
				const session = JSON.parse(devSession);
				setDevUser(session.user);
			} catch (e) {
				// Silent fail - invalid session format
			}
		}
	}
}, []);

const currentUser = user || devUser;

// Changed null check to use currentUser instead of user
if (!currentUser) {
	return null;
}

const { name, email, image } = currentUser;
```

**Why This Was Needed:** NavBar was updated to support dev sessions but UserMenu was not, causing the account icon and settings popup to disappear in the bottom-left sidebar. This made testing theme switching (light/dark mode), accessing docs, and account settings impossible during dev mode.

**⚠️ SECURITY RISK:** User menu renders based on client-side localStorage data

**REVERT ACTION (Week 4):**
- Remove `devUser` state and useEffect
- Change `const currentUser = user || devUser;` to `const currentUser = user;`
- Change the null check from `!currentUser` to `!user`
- Change destructuring from `currentUser` to `user`

---

## ✅ WEEK 4 DAY 20 CHECKLIST

**Before connecting real backend, complete ALL of these:**

### **Security Revert Tasks:**

#### Middleware & Routing
- [ ] Uncomment auth check in `apps/web/proxy.ts` (lines 22-40)
- [ ] Remove `/auth/dev-login` and `/auth/dev-logout` from `pathsWithoutLocale` array (if added)

#### Layout Files (5 files)
- [ ] Uncomment session check in `apps/web/app/(saas)/layout.tsx` (lines 22-24)
- [ ] Remove `&& session` guards from prefetch queries in `(saas)/layout.tsx`
- [ ] Uncomment session check in `apps/web/app/(saas)/app/layout.tsx` (lines 15-21)
- [ ] Move `getOrganizationList()` outside if block in `app/layout.tsx`
- [ ] Uncomment session check in `apps/web/app/(saas)/app/(account)/settings/layout.tsx` (lines 20-22)
- [ ] Remove fallback values in settings layout (use `session.user.name` directly)
- [ ] Uncomment both checks in `apps/web/app/(saas)/app/(account)/admin/layout.tsx` (lines 16-22)

#### Settings Pages (3 files)
- [ ] Uncomment session check in `settings/general/page.tsx` (lines 22-24)
- [ ] Uncomment session check in `settings/security/page.tsx` (lines 30-32)
- [ ] Remove conditional data fetching in `settings/security/page.tsx`
- [ ] Uncomment session check in `settings/danger-zone/page.tsx` (lines 18-20)

#### Dev Files to Delete
- [ ] Delete `apps/web/app/auth/dev-login/` folder entirely
- [ ] Delete `apps/web/app/auth/dev-logout/` folder entirely

#### NavBar, UserMenu & Mock Data
- [ ] Remove devUser state and useEffect from `NavBar.tsx` (lines 34-48)
- [ ] Change `currentUser = user || devUser` to just `user` in `NavBar.tsx`
- [ ] Remove devUser state and useEffect from `UserMenu.tsx` (lines 34-50)
- [ ] Change `currentUser = user || devUser` to just `user` in `UserMenu.tsx`
- [ ] Implement admin check via AdminUser table, not `user.role`
- [ ] Delete `mockUsers` export from `mock-data.ts` (lines 27-64)

#### Environment Variables
- [ ] Replace all dummy values in `.env.local` with real credentials

### **Real Auth Implementation:**
- [ ] Verify Supabase database is connected
- [ ] Verify better-auth is configured correctly
- [ ] Test real login flow with email/password
- [ ] Test social login if enabled (Google, GitHub)
- [ ] Verify session persistence works
- [ ] Test subscription gating works (from CP6)
- [ ] Verify AdminUser table checks work correctly
- [ ] Test onboarding flow if enabled

### **Security Testing:**
- [ ] Try accessing `/app/*` without login → should redirect to `/auth/login`
- [ ] Try accessing `/app/admin/*` without admin role → should redirect or 403
- [ ] Try accessing `/app/settings/*` without login → should redirect
- [ ] Verify localStorage cannot grant admin access
- [ ] Test that `/auth/dev-login` returns 404
- [ ] Verify session expiration works correctly
- [ ] Test logout clears session properly

---

## 📊 CHANGE STATISTICS

**Total Files Modified:** 12
- Middleware: 1
- Layouts: 5
- Pages: 3
- Components: 2 (NavBar, UserMenu)
- Data: 1

**Total Files Deleted:** 1
- API route (unused)

**Total Files to Delete in Week 4:** 2
- Dev login page
- Dev logout page

**Total Auth Checks Disabled:** 8
- 1 middleware check
- 4 layout-level checks
- 3 page-level checks

**Lines of Code Changed:** ~150 lines across all files

---

## 🚨 WHY THIS MATTERS

**Current State (Weeks 1-3):**
- ✅ Perfect for frontend development
- ✅ No backend needed
- ✅ Can test all UI flows
- ✅ Can test role-based menu visibility
- ❌ **Zero real security**
- ❌ **Anyone can access everything**
- ❌ **Admin status from localStorage**

**After Revert (Week 4+):**
- ✅ Real authentication required
- ✅ Session validation on every request
- ✅ Admin checks via database AdminUser table
- ✅ Proper authorization at all levels
- ✅ Production-ready security
- ✅ Session expiration enforced
- ✅ HTTPS-only cookies

---

## 📝 COMMIT MESSAGE TEMPLATE

When you revert these changes, use this commit message:

```
security: remove dev mode shortcuts and enable real auth

BREAKING CHANGE: Dev login removed, real auth required

- Uncomment 8 session checks across layouts and pages
- Delete dev-login and dev-logout routes
- Remove devUser localStorage reading from NavBar
- Replace dummy env vars with real credentials
- Implement AdminUser table checks
- Remove mockUsers from mock-data.ts

CLOSES: Week 4 Day 20 - Backend Connection
REFS: DEV-MODE-CHANGES.md, CHECKPOINTS.md CP6

All auth is now server-side validated.
No client-side auth workarounds remain.
```

---

## 📍 REFERENCE DOCUMENTS

- **BUILD-PLAN.md - Day 20:** "Backend Connection" section
- **CHECKPOINTS.md - CP6:** "Post-Backend Connection Verification"
- **IMPLEMENTATION-NOTES.md - Day 11:** "Route Protection (proxy.ts)" section

---

## 🎯 QUICK REFERENCE: FILES TO REVERT

### Uncomment Auth Checks In:
1. `apps/web/proxy.ts`
2. `apps/web/app/(saas)/layout.tsx`
3. `apps/web/app/(saas)/app/layout.tsx`
4. `apps/web/app/(saas)/app/(account)/settings/layout.tsx`
5. `apps/web/app/(saas)/app/(account)/admin/layout.tsx`
6. `apps/web/app/(saas)/app/(account)/settings/general/page.tsx`
7. `apps/web/app/(saas)/app/(account)/settings/security/page.tsx`
8. `apps/web/app/(saas)/app/(account)/settings/danger-zone/page.tsx`

### Delete Entirely:
1. `apps/web/app/auth/dev-login/` (folder)
2. `apps/web/app/auth/dev-logout/` (folder)

### Modify:
1. `apps/web/modules/saas/shared/components/NavBar.tsx` - remove devUser logic
2. `apps/web/modules/saas/shared/components/UserMenu.tsx` - remove devUser logic
3. `apps/web/lib/mock-data.ts` - delete mockUsers export

---

**END OF DEV MODE DOCUMENTATION**

*This document ensures no security holes remain when switching to production auth.*
