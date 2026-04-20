---
name: Admin Dashboard Polish Fixes
overview: "Implement 7 critical UX/UI fixes identified in the audit: error states, search debouncing, active sidebar indicators, notification settings warning, skip-to-content link, title styling consistency, and stats card hover standardization."
todos:
  - id: create-debounce-hook
    content: Create use-debounced-search.ts hook with 300ms delay
    status: completed
  - id: sidebar-active-indicator
    content: Add isActive prop to AdminSidebar menu buttons
    status: completed
  - id: skip-to-content
    content: Add skip link to layout and main content id
    status: completed
  - id: standardize-titles
    content: Add text-balance to all page titles across 7 pages
    status: completed
  - id: remove-stats-hover
    content: Remove hover effects from subscriptions page stats cards
    status: completed
  - id: add-error-states
    content: Add error handling UI to 6 admin pages
    status: completed
  - id: apply-debouncing
    content: Apply useDebouncedSearch hook to 5 pages
    status: completed
  - id: notification-warning
    content: Add warning alert to notification settings page
    status: completed
---

# Admin Dashboard Polish Fixes - Implementation Plan

## Overview

Implement 7 high-priority fixes from the audit report to enhance error handling, search performance, navigation clarity, and UI consistency across the admin dashboard.

---

## Files to Modify

### New Files (1)

- `apps/web/modules/saas/admin/hooks/use-debounced-search.ts` - Shared search debouncing hook

### Modified Files (11)

- `apps/web/modules/saas/admin/component/AdminSidebar.tsx` - Active page indicator
- `apps/web/app/(admin)/admin/layout.tsx` - Skip to main content link
- `apps/web/app/(admin)/admin/users/page.tsx` - Error state + debouncing + title
- `apps/web/app/(admin)/admin/announcements/page.tsx` - Error state + debouncing + title
- `apps/web/app/(admin)/admin/affiliates/page.tsx` - Error state + debouncing + title
- `apps/web/app/(admin)/admin/audit-log/page.tsx` - Error state + debouncing + title
- `apps/web/app/(admin)/admin/notifications/page.tsx` - Error state + title
- `apps/web/app/(admin)/admin/subscriptions/page.tsx` - Error state + title + remove hover
- `apps/web/app/(admin)/admin/notifications/settings/page.tsx` - Warning alert
- `apps/web/app/(admin)/admin/page.tsx` - Title styling
- `apps/web/app/(admin)/admin/audit-log/page.tsx` - Title styling

---

## Implementation Steps

### Step 1: Create Shared Debounced Search Hook (15 min)

**File:** `apps/web/modules/saas/admin/hooks/use-debounced-search.ts`

Create reusable hook for debounced search across all admin pages:

```typescript
"use client"

import { useState, useEffect } from "react"

export function useDebouncedSearch(initialValue = "", delay = 300) {
  const [searchQuery, setSearchQuery] = useState(initialValue)
  const [debouncedQuery, setDebouncedQuery] = useState(initialValue)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, delay)
    
    return () => clearTimeout(timer)
  }, [searchQuery, delay])
  
  return { searchQuery, setSearchQuery, debouncedQuery }
}
```

---

### Step 2: Add Active Page Indicator to Sidebar (10 min)

**File:** `apps/web/modules/saas/admin/component/AdminSidebar.tsx`

Update `SidebarMenuButton` to show active state based on current pathname:

```typescript
// Line ~104-114, inside the map function
<SidebarMenuButton 
  asChild 
  isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
>
  <Link href={item.href} className="flex items-center gap-3">
    <item.icon className="h-4 w-4" />
    <span>{item.title}</span>
    {item.badge && (
      <Badge status="info" className="ml-auto text-xs">
        {item.badge}
      </Badge>
    )}
  </Link>
</SidebarMenuButton>
```

The `isActive` prop will apply the active styling (typically highlighted background) when the current page matches.

---

### Step 3: Add Skip to Main Content Link (10 min)

**File:** `apps/web/app/(admin)/admin/layout.tsx`

Add accessibility skip link before the main content wrapper:

```typescript
// After the <SidebarProvider> opening tag, add:
<a 
  href="#main-content" 
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:outline-none focus:ring-2 focus:ring-primary"
>
  Skip to main content
</a>

// Then wrap the main content area with id:
<main id="main-content" className="flex-1 overflow-auto">
  {children}
</main>
```

---

### Step 4: Standardize Page Title Styling (10 min)

Add `text-balance` class to all page titles for better typography:

**Files to update:**

- `apps/web/app/(admin)/admin/page.tsx` (line ~68) - Already has it, verify
- `apps/web/app/(admin)/admin/users/page.tsx` (line ~145)
- `apps/web/app/(admin)/admin/subscriptions/page.tsx` (line ~370)
- `apps/web/app/(admin)/admin/announcements/page.tsx` (line ~203)
- `apps/web/app/(admin)/admin/affiliates/page.tsx` (line ~211)
- `apps/web/app/(admin)/admin/audit-log/page.tsx` (line ~182)
- `apps/web/app/(admin)/admin/notifications/page.tsx` (line ~139)

Change from:

```typescript
<h1 className="text-3xl font-bold tracking-tight">Title</h1>
```

To:

```typescript
<h1 className="text-3xl font-bold tracking-tight text-balance">Title</h1>
```

---

### Step 5: Fix Stats Card Hover Effects (10 min)

Remove hover effects from informational stats cards on subscriptions page.

**File:** `apps/web/app/(admin)/admin/subscriptions/page.tsx`

Find the stats cards section (around line ~410-480) and remove these classes:

- `hover:scale-[1.02]`
- `hover:shadow-lg`
- `transition-all`

Change from:

```typescript
<Card className="transition-all hover:scale-[1.02] hover:shadow-lg">
```

To:

```typescript
<Card>
```

Apply to all 6 stats cards in the grid.

---

### Step 6: Add Error States to All Admin Pages (45 min)

Add consistent error handling to 6 pages. Each page needs:

1. Import `RefreshCw` icon from lucide-react
2. Destructure `isError`, `error`, `refetch` from useQuery
3. Add error state UI after loading check

**Pattern to apply:**

```typescript
// Add to imports
import { /* existing imports */, RefreshCw, AlertCircle } from "lucide-react"

// Update useQuery destructuring
const { data, isLoading, isError, error, refetch } = useQuery(...)

// Add after loading check
if (isError) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="font-semibold text-lg">Failed to load data</h3>
      <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
        {error instanceof Error ? error.message : "An unexpected error occurred. Please try again."}
      </p>
      <Button onClick={() => refetch()} className="mt-4">
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  )
}
```

**Files to update:**

1. `apps/web/app/(admin)/admin/users/page.tsx` (after line ~62)
2. `apps/web/app/(admin)/admin/subscriptions/page.tsx` (after line ~341)
3. `apps/web/app/(admin)/admin/announcements/page.tsx` (after line ~100)
4. `apps/web/app/(admin)/admin/affiliates/page.tsx` (after line ~59)
5. `apps/web/app/(admin)/admin/audit-log/page.tsx` (after line ~55)
6. `apps/web/app/(admin)/admin/notifications/page.tsx` (after line ~45)

---

### Step 7: Apply Debounced Search Hook (30 min)

Replace direct search state with debounced hook in 4 pages (subscriptions already has manual debouncing, which we'll refactor).

**Pattern to apply:**

```typescript
// Add import
import { useDebouncedSearch } from "@saas/admin/hooks/use-debounced-search"

// Replace useState line
// OLD: const [searchQuery, setSearchQuery] = useState("")
// NEW:
const { searchQuery, setSearchQuery, debouncedQuery } = useDebouncedSearch()

// Remove any manual debouncing useEffect (subscriptions page only)

// Update useQuery to use debouncedQuery
const { data, isLoading, isError, error, refetch } = useQuery(
  orpc.admin.XXX.list.queryOptions({
    input: {
      searchTerm: debouncedQuery || undefined, // Use debouncedQuery
      // ... other filters
    },
  }),
)
```

**Files to update:**

1. `apps/web/app/(admin)/admin/users/page.tsx`

   - Line ~32: Replace `useState`
   - Line ~55: Use `debouncedQuery` in queryOptions

2. `apps/web/app/(admin)/admin/subscriptions/page.tsx`

   - Line ~72: Replace `useState` and `debouncedSearchQuery` state
   - Lines ~76-82: Remove manual debouncing useEffect
   - Line ~86: Use `debouncedQuery` in queryOptions

3. `apps/web/app/(admin)/admin/announcements/page.tsx`

   - Line ~85: Replace `useState`
   - Line ~103: Use `debouncedQuery` in queryOptions

4. `apps/web/app/(admin)/admin/affiliates/page.tsx`

   - Line ~46: Replace `useState`
   - Line ~61: Use `debouncedQuery` in queryOptions

5. `apps/web/app/(admin)/admin/audit-log/page.tsx`

   - Line ~46: Replace `useState`
   - Line ~58: Use `debouncedQuery` in queryOptions

---

### Step 8: Add Notification Settings Warning (15 min)

**File:** `apps/web/app/(admin)/admin/notifications/settings/page.tsx`

Add alert component after the page title, before the first Card (around line ~60):

```typescript
// Add import
import { Alert, AlertDescription } from "@ui/components/alert"
import { AlertCircle } from "lucide-react"

// After the page title div, add:
{(Object.values(settings.showInBadge).every(v => !v) || 
  Object.values(settings.showInList).every(v => !v)) && (
  <Alert variant="warning" className="border-amber-500/50 bg-amber-500/10">
    <AlertCircle className="h-4 w-4 text-amber-500" />
    <AlertDescription className="text-sm">
      {Object.values(settings.showInBadge).every(v => !v) && 
        "You've disabled all notification types in the badge. You won't see any unread count. "}
      {Object.values(settings.showInList).every(v => !v) && 
        "You've disabled all notification types in the list. Your notifications page will be empty."}
    </AlertDescription>
  </Alert>
)}
```

---

## Testing Checklist

After implementation, verify:

### Error States

- [ ] Navigate to each admin page (users, subscriptions, announcements, affiliates, audit-log, notifications)
- [ ] Simulate network error (disconnect internet or use DevTools offline mode)
- [ ] Verify error UI displays with retry button
- [ ] Click "Try Again" and verify it refetches data

### Search Debouncing

- [ ] Open users, announcements, affiliates, audit-log pages
- [ ] Type quickly in search box
- [ ] Verify no API calls until 300ms pause (check Network tab)
- [ ] Verify search results appear after debounce delay

### Active Sidebar

- [ ] Navigate to each admin page
- [ ] Verify current page is highlighted in sidebar
- [ ] Verify highlight persists after sidebar auto-closes and reopens

### Skip to Content

- [ ] Tab to page (first tab should focus skip link)
- [ ] Press Enter on skip link
- [ ] Verify focus moves to main content area

### Title Styling

- [ ] Visually inspect all page titles
- [ ] Verify text wraps nicely on narrow screens
- [ ] Verify `text-balance` class is applied

### Stats Cards

- [ ] Open subscriptions page
- [ ] Hover over stats cards
- [ ] Verify NO hover effects (no scale, no shadow)

### Notification Warning

- [ ] Navigate to `/admin/notifications/settings`
- [ ] Toggle OFF all badge notification types
- [ ] Verify warning alert appears
- [ ] Toggle OFF all list notification types
- [ ] Verify warning message updates

---

## Time Estimate

- Step 1: Create hook (15 min)
- Step 2: Sidebar active state (10 min)
- Step 3: Skip link (10 min)
- Step 4: Title styling (10 min)
- Step 5: Stats card hover (10 min)
- Step 6: Error states (45 min)
- Step 7: Apply debouncing (30 min)
- Step 8: Notification warning (15 min)
- Testing: (20 min)

**Total: ~2.5 hours**

---

## Success Criteria

- All 6 admin pages display proper error states when queries fail
- All 5 search inputs debounce at 300ms
- Active page is visually indicated in sidebar
- Keyboard users can skip to main content
- All page titles use consistent styling
- Stats cards have no hover effects
- Notification settings shows warning when all types disabled
- No TypeScript errors
- Build succeeds

---

## Notes

- Error states use same visual pattern across all pages for consistency
- Debounced search hook is reusable for future admin pages
- Active sidebar indicator uses built-in SidebarMenuButton `isActive` prop
- Skip link is hidden until keyboard focused (accessibility best practice)
- All changes maintain existing mobile redirect behavior