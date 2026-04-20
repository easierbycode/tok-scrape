---
name: Database GDPR Compliance Setup
overview: Implement GDPR-compliant database operations with soft deletes, data export, and proper audit logging. This plan includes a checkpoint to verify Supabase connectivity before proceeding with database-dependent changes.
todos:
  - id: phase1-cleanup
    content: Remove Drizzle ORM and update package.json
    status: pending
  - id: phase1-health
    content: Create health check service and API endpoint
    status: pending
  - id: phase1-errors
    content: Create error handler for better error messages
    status: pending
  - id: phase1-logging
    content: Add slow query logging to Prisma client
    status: pending
  - id: phase1-gdpr
    content: Create GDPR deletion service with all functions
    status: pending
  - id: phase1-cron
    content: Create cron job for auto-purging deleted users
    status: pending
  - id: phase1-api
    content: Create user self-delete API endpoint
    status: pending
  - id: checkpoint
    content: "VERIFY: Supabase is online and healthy before proceeding"
    status: pending
  - id: phase2-schema
    content: Update Prisma schema with soft delete fields and indexes
    status: pending
  - id: phase2-migrate
    content: Create and apply database migration
    status: pending
  - id: phase2-test
    content: Test database connection and GDPR functions
    status: pending
  - id: phase3-delete-dialog
    content: Create DeleteUserDialog component
    status: pending
  - id: phase3-export-dialog
    content: Create ExportUserDataDialog component
    status: pending
  - id: phase3-menu
    content: Update UserActionsMenu with new options
    status: pending
  - id: phase3-pending
    content: Create pending deletions page
    status: pending
  - id: phase3-user-delete
    content: Update user self-delete form
    status: pending
  - id: phase4-orpc
    content: Create/update ORPC admin procedures
    status: pending
  - id: testing
    content: Complete full testing checklist
    status: pending
isProject: false
---

# Database GDPR Compliance & Improvements

## Project Context

**Note:** This is a TikTok Shop education membership platform. Organizations feature is disabled and not used - all users are individual members with their own subscriptions.

## Phase 1: Preparation (No Database Required)

These changes can be made while Supabase is down - they're code-only preparations.

### 1.1 Remove Drizzle ORM (Unused Code)

**Why:** You have both Prisma and Drizzle configured, but only use Prisma. Removes ~50MB of unused dependencies.

**Delete:**

- Remove entire folder: `packages/database/drizzle/`

**Update `[packages/database/package.json](packages/database/package.json)`:**

- Remove from dependencies: `drizzle-orm`, `drizzle-zod`
- Remove from devDependencies: `drizzle-kit`

**Run:** `pnpm install` to clean up node_modules

---

### 1.2 Create Health Check Service

**Create `[packages/database/lib/health-check.ts](packages/database/lib/health-check.ts)`:**

```typescript
import { db } from "../prisma/client";

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

**Create `[apps/web/app/api/health/route.ts](apps/web/app/api/health/route.ts)`:**

```typescript
import { checkDatabaseHealth } from "@repo/database/lib/health-check";
import { NextResponse } from "next/server";

export async function GET() {
  const dbHealth = await checkDatabaseHealth();
  
  return NextResponse.json({
    status: dbHealth.healthy ? "healthy" : "unhealthy",
    database: dbHealth,
    timestamp: new Date().toISOString(),
  }, {
    status: dbHealth.healthy ? 200 : 503
  });
}
```

---

### 1.3 Create Error Handler

**Create `[packages/database/lib/error-handler.ts](packages/database/lib/error-handler.ts)`:**

```typescript
import { Prisma } from "../prisma/generated/client";
import { logger } from "@repo/logs";

export function handleDatabaseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new Error('A record with this value already exists');
      case 'P2025':
        throw new Error('Record not found');
      case 'P2003':
        throw new Error('Foreign key constraint failed');
      default:
        logger.error('Database error', { code: error.code, meta: error.meta });
        throw new Error('Database operation failed');
    }
  }
  
  if (error instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Database connection failed', { error });
    throw new Error('Unable to connect to database');
  }

  logger.error('Unknown database error', { error });
  throw new Error('An unexpected error occurred');
}
```

---

### 1.4 Add Slow Query Logging

**Update `[packages/database/prisma/client.ts](packages/database/prisma/client.ts)`:**

Add logging configuration to detect slow queries:

```typescript
const client = new PrismaClient({
  adapter,
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Add slow query logging in production
if (process.env.NODE_ENV === 'production') {
  client.$on('query', (e: any) => {
    if (e.duration > 2000) {  // Queries over 2 seconds
      logger.warn('Slow query detected', {
        query: e.query,
        duration: e.duration,
        timestamp: e.timestamp,
      });
    }
  });
}
```

---

### 1.5 Create GDPR Deletion Service

**Create `[packages/database/lib/gdpr-deletion.ts](packages/database/lib/gdpr-deletion.ts)`:**

This is the core service for GDPR-compliant user deletion:

```typescript
import { db } from "../prisma/client";
import { logAdminAction } from "./audit-logger";
import { logger } from "@repo/logs";

interface DeletionOptions {
  userId: string;
  deletedBy: string;
  reason: "user_request" | "admin_action" | "gdpr";
  immediate?: boolean;
}

export async function requestUserDeletion({
  userId,
  deletedBy,
  reason,
  immediate = false,
}: DeletionOptions) {
  
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      purchases: {
        where: { 
          type: "SUBSCRIPTION",
          status: { in: ["active", "trialing"] }
        }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.purchases.length > 0 && !immediate) {
    throw new Error("Cannot delete user with active subscriptions");
  }

  const now = new Date();
  const gdprGracePeriod = 30; // days
  const financialRetentionYears = 7; // EU requirement
  
  const scheduledPurgeAt = new Date(now);
  scheduledPurgeAt.setDate(scheduledPurgeAt.getDate() + gdprGracePeriod);
  
  const dataRetentionUntil = new Date(now);
  dataRetentionUntil.setFullYear(dataRetentionUntil.getFullYear() + financialRetentionYears);

  // Soft delete and anonymize
  await db.user.update({
    where: { id: userId },
    data: {
      deletedAt: now,
      deletedBy,
      deletionReason: reason,
      scheduledPurgeAt: immediate ? now : scheduledPurgeAt,
      dataRetentionUntil,
      
      // Anonymize PII immediately
      name: "Deleted User",
      email: `deleted_${userId}@deleted.local`,
      image: null,
      username: null,
      displayUsername: null,
      locale: null,
      notificationEmail: null,
      stripeEmail: null,
      discordId: null,
      discordUsername: null,
      discordConnected: false,
    }
  });

  // Update purchases with retention date
  await db.purchase.updateMany({
    where: { userId },
    data: {
      deletedAt: now,
      financialRetentionUntil: dataRetentionUntil,
    }
  });

  await logAdminAction({
    adminUserId: deletedBy,
    action: "DELETE_USER",
    targetType: "user",
    targetId: userId,
    metadata: {
      reason,
      immediate,
      scheduledPurgeAt: scheduledPurgeAt.toISOString(),
    }
  });

  return {
    success: true,
    scheduledPurgeAt,
    message: immediate 
      ? "User deleted immediately"
      : `User scheduled for deletion on ${scheduledPurgeAt.toISOString()}`
  };
}

export async function restoreUser(userId: string, restoredBy: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  if (!user || !user.deletedAt) {
    throw new Error("User not found or not deleted");
  }

  if (user.email.includes("@deleted.local")) {
    throw new Error("User data was anonymized and cannot be restored");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      deletedAt: null,
      deletedBy: null,
      deletionReason: null,
      scheduledPurgeAt: null,
    }
  });

  await logAdminAction({
    adminUserId: restoredBy,
    action: "SYSTEM_ACTION",
    targetType: "user",
    targetId: userId,
    metadata: { action: "restore_user" }
  });

  return { success: true };
}

export async function purgeScheduledDeletions() {
  const now = new Date();
  
  const usersToDelete = await db.user.findMany({
    where: {
      scheduledPurgeAt: { lte: now },
      deletedAt: { not: null },
    },
    include: { purchases: true }
  });

  for (const user of usersToDelete) {
    const hasRetainedPurchases = user.purchases.some(p => 
      p.financialRetentionUntil && p.financialRetentionUntil > now
    );

    if (hasRetainedPurchases) continue;

    await db.user.delete({ where: { id: user.id } });
  }

  return { purged: usersToDelete.length };
}

export async function exportUserData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      purchases: true,
      sessions: { select: { createdAt: true, ipAddress: true } },
      notifications: true,
    }
  });

  if (!user) throw new Error("User not found");

  return {
    profile: {
      name: user.name,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
    },
    purchases: user.purchases.map(p => ({
      type: p.type,
      status: p.status,
      createdAt: p.createdAt,
    })),
    sessions: user.sessions,
    notifications: user.notifications,
  };
}
```

---

### 1.6 Create Cron Job for Auto-Purge

**Create `[apps/web/app/api/cron/purge-deleted-users/route.ts](apps/web/app/api/cron/purge-deleted-users/route.ts)`:**

```typescript
import { purgeScheduledDeletions } from "@repo/database/lib/gdpr-deletion";
import { logger } from "@repo/logs";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron authentication)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    logger.info("Starting scheduled user purge cron");
    const result = await purgeScheduledDeletions();
    logger.info("Purge completed", result);
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error("Purge failed", { error });
    return NextResponse.json(
      { error: 'Purge failed' },
      { status: 500 }
    );
  }
}
```

---

### 1.7 Create User Self-Delete API

**Create `[apps/web/app/api/user/request-deletion/route.ts](apps/web/app/api/user/request-deletion/route.ts)`:**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@saas/auth/lib/server";
import { requestUserDeletion } from "@repo/database/lib/gdpr-deletion";

export async function POST() {
  const session = await getSession();
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await requestUserDeletion({
      userId: session.user.id,
      deletedBy: session.user.id,  // Self-deletion
      reason: "user_request",
      immediate: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Deletion failed" },
      { status: 500 }
    );
  }
}
```

---

## CHECKPOINT: Verify Supabase is Online

Before proceeding to Phase 2, verify that Supabase is operational:

1. Check Supabase status page: [https://status.supabase.com](https://status.supabase.com)
2. Verify your project shows as "Healthy" in the dashboard
3. Test the health check endpoint: `curl http://localhost:3000/api/health`
4. Try running: `pnpm prisma studio` from `packages/database/`

If all checks pass, proceed to Phase 2. If not, wait for Supabase to resolve the incident.

---

## Phase 2: Database Schema Changes (REQUIRES DATABASE)

### 2.1 Update Prisma Schema

**Update `[packages/database/prisma/schema.prisma](packages/database/prisma/schema.prisma)`:**

Add soft delete fields to User model (around line 19):

```prisma
model User {
  id                 String    @id @default(cuid())
  name               String
  email              String
  // ... existing fields ...
  
  // GDPR Compliance Fields
  deletedAt          DateTime? @map("deleted_at")
  deletedBy          String?   @map("deleted_by")
  deletionReason     String?   @map("deletion_reason")
  scheduledPurgeAt   DateTime? @map("scheduled_purge_at")
  dataRetentionUntil DateTime? @map("data_retention_until")
  
  // Add missing indexes
  @@index([deletedAt])
  @@index([scheduledPurgeAt])
  @@index([role])
  @@index([banned])
  @@index([discordConnected])
  @@index([paymentsCustomerId])
}
```

Add to Purchase model (around line 250):

```prisma
model Purchase {
  // ... existing fields ...
  
  // Financial Retention
  deletedAt               DateTime? @map("deleted_at")
  financialRetentionUntil DateTime? @map("financial_retention_until")
  
  @@index([financialRetentionUntil])
}
```

Add indexes to Account model (around line 108):

```prisma
model Account {
  // ... existing fields ...
  
  @@index([userId])
  @@index([providerId, accountId])
}
```

Add indexes to Session model (around line 88):

```prisma
model Session {
  // ... existing fields ...
  
  @@index([userId])
  @@index([expiresAt])
}
```

Add indexes to Verification model (around line 129):

```prisma
model Verification {
  // ... existing fields ...
  
  @@index([identifier])
  @@index([expiresAt])
}
```

---

### 2.2 Create and Apply Migration

From `packages/database/` directory:

```bash
pnpm prisma migrate dev --name gdpr_compliance_and_indexes
```

This creates a migration file with all schema changes.

---

### 2.3 Test Database Connection

Verify everything works:

```bash
pnpm prisma generate
pnpm prisma studio
```

Test the GDPR functions work (create a test in your preferred way).

---

## Phase 3: UI Components (REQUIRES DATABASE)

### 3.1 Create Delete User Dialog

**Create `[apps/web/modules/saas/admin/component/users/DeleteUserDialog.tsx](apps/web/modules/saas/admin/component/users/DeleteUserDialog.tsx)`:**

This replaces the simple confirm dialog with a proper GDPR-compliant flow.

Key features:

- Dropdown for deletion reason
- Shows 30-day grace period
- Explains what happens
- Uses the GDPR deletion service

---

### 3.2 Create Export User Data Dialog

**Create `[apps/web/modules/saas/admin/component/users/ExportUserDataDialog.tsx](apps/web/modules/saas/admin/component/users/ExportUserDataDialog.tsx)`:**

Downloads user data as JSON (GDPR Right to Data Portability).

---

### 3.3 Update User Actions Menu

**Update `[apps/web/modules/saas/admin/component/users/UserActionsMenu.tsx](apps/web/modules/saas/admin/component/users/UserActionsMenu.tsx)`:**

Changes:

- Add "Export User Data" menu item (around line 206)
- Update `handleDelete()` to open DeleteUserDialog instead of simple confirm
- Add new props for dialog state management

---

### 3.4 Create Pending Deletions Page

**Create `[apps/web/app/(admin)/admin/users/pending-deletions/page.tsx](apps/web/app/\\\\\\\\\\\(admin)`/admin/users/pending-deletions/page.tsx):**

Shows list of users scheduled for deletion with:

- User name/email
- Deletion date
- Reason
- Days remaining (with red warning if < 7 days)
- Restore button

---

### 3.5 Update User Self-Delete Form

**Update `[apps/web/modules/saas/settings/components/DeleteAccountForm.tsx](apps/web/modules/saas/settings/components/DeleteAccountForm.tsx)`:**

Replace around line 18:

```typescript
// OLD:
const { error } = await authClient.deleteUser({});

// NEW:
const response = await fetch('/api/user/request-deletion', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});
const data = await response.json();
if (!response.ok) throw new Error(data.error);
```

Update success message to mention 30-day grace period.

---

## Phase 4: ORPC Procedures (REQUIRES DATABASE)

Find your ORPC admin procedures (likely in `packages/api/modules/admin/`) and create/update:

### 4.1 Delete User Procedure

Update the existing `deleteUser` procedure to use the GDPR service instead of hard delete.

### 4.2 Create Export User Data Procedure

New procedure that calls `exportUserData()` service.

### 4.3 Create Restore User Procedure

New procedure for restoring soft-deleted users.

---

## Testing Checklist

After implementation:

- Health check endpoint returns 200
- Admin can delete user with reason
- User appears in pending deletions page
- Admin can restore deleted user
- Admin can export user data
- User can request own deletion
- Deletion anonymizes PII immediately
- Financial data is preserved (purchases with retention dates)
- Audit logs are created
- Slow queries are logged (check logs after testing)
- Discord info is properly cleared on deletion (discordId, discordUsername)
- Stripe customer data is preserved for financial records

---

## Environment Variables to Add

Add to `.env`:

```bash
# Cron job authentication
CRON_SECRET=generate_random_string_here
```

---

## Vercel Cron Setup (After Deploy)

In `vercel.json` or project settings, add daily cron:

```json
{
  "crons": [{
    "path": "/api/cron/purge-deleted-users",
    "schedule": "0 2 * * *"
  }]
}
```

Runs daily at 2 AM to purge users past 30-day grace period.