---
name: User Experience During Outages
overview: Implement production-grade error handling, retry logic, maintenance mode, Sentry monitoring, and a health status indicator for the 400-member launch. This plan builds on infrastructure from the GDPR Compliance Plan and ensures users experience graceful degradation during database outages.
todos:
  - id: phase1-wrapper
    content: Create database error wrapper with user-friendly messages and Sentry integration
    status: completed
  - id: phase1-boundary
    content: Create DatabaseErrorBoundary component (wraps existing ErrorBoundary)
    status: completed
  - id: phase1-pages
    content: Update critical content pages with error boundaries
    status: completed
  - id: phase2-retry
    content: Create retry utility and update QueryClient with smart retry
    status: completed
  - id: phase2-slow
    content: Add global slow-loading observer to QueryClient
    status: completed
  - id: phase3-config
    content: Add maintenance mode config and types
    status: completed
  - id: phase3-proxy
    content: Update proxy.ts with maintenance mode check
    status: completed
  - id: phase3-maintenance-page
    content: Create maintenance page
    status: completed
  - id: phase3-admin-toggle
    content: Create admin maintenance mode toggle (database-backed + env var fallback)
    status: completed
  - id: phase3-auth-error
    content: Create AuthErrorDisplay component
    status: completed
  - id: phase4-sentry
    content: Install and configure Sentry SDK (client, server, edge)
    status: completed
  - id: phase4-nextconfig
    content: Update next.config.ts with withSentryConfig and CSP
    status: completed
  - id: phase4-integrate
    content: Integrate Sentry with error wrapper and error boundary
    status: completed
  - id: phase4-health-indicator
    content: Add health status indicator to admin sidebar
    status: completed
  - id: testing
    content: Complete full testing checklist
    status: completed
isProject: false
---

# User Experience During Database Outages

## Prerequisites

This plan assumes the GDPR Compliance Plan has been completed, which provides:

- Health check service at `packages/database/lib/health-check.ts`
- Error handler at `packages/database/lib/error-handler.ts`
- Health check API endpoint at `apps/web/app/api/health/route.ts`
- Logger configured with slow query logging

These foundational pieces will be extended and integrated throughout the application.

---

## Phase 1: User-Friendly Error Messages

Replace technical database errors with helpful, user-friendly messages while preserving detailed logs for troubleshooting.

### 1.1 Create Database Error Wrapper

**Create `packages/database/lib/error-wrapper.ts`:**

This wraps database queries with automatic error translation, logging, and Sentry reporting.

```typescript
import { Prisma } from "./prisma/generated/client";
import { logger } from "@repo/logs";
import * as Sentry from "@sentry/nextjs";

export interface UserFriendlyError {
  userMessage: string;
  shouldRetry: boolean;
  isTemporary: boolean;
}

export async function wrapDatabaseQuery<T>(
  queryFn: () => Promise<T>,
  context: {
    operation: string;
    userId?: string;
    route?: string;
  }
): Promise<{ data?: T; error?: UserFriendlyError }> {
  try {
    const data = await queryFn();
    return { data };
  } catch (error) {
    // Log detailed error for troubleshooting
    logger.error('Database operation failed', {
      operation: context.operation,
      userId: context.userId,
      route: context.route,
      error: error instanceof Error ? error.message : 'Unknown error',
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      timestamp: new Date().toISOString(),
    });

    // Report to Sentry with context
    Sentry.captureException(error, {
      tags: {
        operation: context.operation,
        route: context.route || 'unknown',
      },
      extra: {
        userId: context.userId,
        prismaCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      },
    });

    // Determine user-friendly message
    const userError = translateDatabaseError(error);
    
    return { error: userError };
  }
}

function translateDatabaseError(error: unknown): UserFriendlyError {
  // Connection/timeout errors (temporary, should retry)
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    (error instanceof Error && 
     (error.message.includes('timeout') || 
      error.message.includes('P2024') ||
      error.message.includes('connection')))
  ) {
    return {
      userMessage: "We're having trouble connecting to our servers. Please try again in a moment.",
      shouldRetry: true,
      isTemporary: true,
    };
  }

  // Known request errors (usually permanent, don't retry)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          userMessage: "This information already exists. Please use different details.",
          shouldRetry: false,
          isTemporary: false,
        };
      case 'P2025':
        return {
          userMessage: "The requested information could not be found.",
          shouldRetry: false,
          isTemporary: false,
        };
      case 'P2003':
        return {
          userMessage: "This action cannot be completed due to related data.",
          shouldRetry: false,
          isTemporary: false,
        };
      default:
        return {
          userMessage: "We encountered an unexpected issue. Our team has been notified.",
          shouldRetry: false,
          isTemporary: false,
        };
    }
  }

  // Unknown errors (log and show generic message)
  return {
    userMessage: "Something went wrong. Please try again or contact support if this persists.",
    shouldRetry: true,
    isTemporary: false,
  };
}
```

### 1.2 Create Database Error Boundary Component

**Create `apps/web/components/DatabaseErrorBoundary.tsx`:**

Wraps the existing `ErrorBoundary` as a composable layer. The `DatabaseErrorBoundary` catches database-specific errors with retry logic and categorized messages. The existing `ErrorBoundary` stays as the outer safety net.

```typescript
"use client";

import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";

interface DatabaseErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  context?: string; // e.g., "content library", "course page"
}

interface DatabaseErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class DatabaseErrorBoundary extends Component<
  DatabaseErrorBoundaryProps,
  DatabaseErrorBoundaryState
> {
  constructor(props: DatabaseErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<DatabaseErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to Sentry
    Sentry.captureException(error, {
      tags: { component: 'DatabaseErrorBoundary', context: this.props.context },
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  reset = () => {
    this.setState((prev) => ({ 
      hasError: false, 
      error: null,
      retryCount: prev.retryCount + 1 
    }));
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      const isDatabaseError = 
        this.state.error.message.includes('database') ||
        this.state.error.message.includes('connection') ||
        this.state.error.message.includes('timeout') ||
        this.state.error.message.includes('P2024');

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <Alert variant="error" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {isDatabaseError 
                ? "Having trouble loading content"
                : "Something went wrong"}
            </AlertTitle>
            <AlertDescription className="mt-2">
              {isDatabaseError ? (
                <>
                  We're experiencing temporary connectivity issues. 
                  {this.props.context && ` Your ${this.props.context} will be available shortly.`}
                  {this.state.retryCount > 2 && (
                    <p className="mt-2 text-xs">
                      Still having issues? Contact support at support@lifepreneur.com
                    </p>
                  )}
                </>
              ) : (
                "Please try refreshing the page. If this persists, contact support."
              )}
            </AlertDescription>
          </Alert>
          <Button onClick={this.reset} className="mt-6">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usage pattern (wrapping existing ErrorBoundary):**

```typescript
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DatabaseErrorBoundary } from "@/components/DatabaseErrorBoundary";

// In layouts or pages:
<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <DatabaseErrorBoundary context="content library">
    <ContentPage />
  </DatabaseErrorBoundary>
</ErrorBoundary>
```

### 1.3 Update Critical Content Pages

**Update `apps/web/app/(saas)/app/(account)/content/page.tsx`:**

Wrap the content page with error boundary:

```typescript
import { DatabaseErrorBoundary } from "@/components/DatabaseErrorBoundary";
import { StreamingLibrary } from "@saas/content/components/streaming-library";
import { PageHeader } from "@saas/shared/components/PageHeader";

export default function ContentPage() {
  return (
    <DatabaseErrorBoundary context="content library">
      <PageHeader
        title="Content Library"
        subtitle="Access all your TikTok Shop training videos"
      />
      <StreamingLibrary />
    </DatabaseErrorBoundary>
  );
}
```

Apply similar patterns to:

- `apps/web/app/(saas)/app/(account)/community/page.tsx`
- `apps/web/app/(saas)/app/(account)/settings/billing/page.tsx`

---

## Phase 2: Smart Retry Logic

Instead of per-component hooks, configure retries and slow-loading detection globally via QueryClient.

### 2.1 Create Retry Utility

**Create `packages/utils/retry.ts`:**

Server-side retry utility for database operations (ORPC procedures, API routes, etc.).

```typescript
import { logger } from "@repo/logs";

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
    shouldRetry = isDatabaseErrorRetryable,
    onRetry,
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      logger.warn('Retrying operation', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

export function isDatabaseErrorRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('p2024') ||
      message.includes('pool') ||
      message.includes('503') ||
      message.includes('network')
    );
  }
  return false;
}
```

**Update `packages/utils/index.ts**` to export the new utility:

```typescript
export * from "./lib/base-url";
export * from "./retry";
```

### 2.2 Update QueryClient with Smart Retry

**Update `apps/web/modules/shared/lib/query-client.ts`:**

Add a smart retry function that only retries connection/timeout errors, not 404s or validation errors. This applies globally to all queries without changing any existing components.

```typescript
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('503') ||
      message.includes('fetch failed') ||
      message.includes('econnrefused')
    );
  }
  // Retry on network-level failures (no response)
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return true;
  }
  return false;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: (failureCount, error) => {
          // Max 2 retries, only for connection/timeout errors
          if (failureCount >= 2) return false;
          return isRetryableError(error);
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}
```

### 2.3 Add Global Slow-Loading Observer

**Create `apps/web/components/SlowQueryObserver.tsx`:**

A global component that monitors all active queries and shows a non-intrusive toast when any query takes longer than expected. No changes to existing components needed.

```typescript
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const SLOW_THRESHOLD_MS = 8000; // 8 seconds

export function SlowQueryObserver() {
  const queryClient = useQueryClient();
  const activeToastRef = useRef<string | number | null>(null);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event?.query) return;

      const queryHash = event.query.queryHash;

      if (event.type === 'updated') {
        // Query finished (success or error) -- clear timer and dismiss toast
        const timer = timersRef.current.get(queryHash);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(queryHash);
        }

        // If no more slow queries, dismiss the toast
        if (timersRef.current.size === 0 && activeToastRef.current) {
          toast.dismiss(activeToastRef.current);
          activeToastRef.current = null;
        }
      }

      if (event.type === 'observerAdded' || 
          (event.type === 'updated' && event.query.state.fetchStatus === 'fetching')) {
        // Query started fetching -- set a slow warning timer
        if (!timersRef.current.has(queryHash)) {
          const timer = setTimeout(() => {
            if (event.query.state.fetchStatus === 'fetching') {
              if (!activeToastRef.current) {
                activeToastRef.current = toast.loading(
                  "Taking longer than usual... Still trying to connect.",
                  { duration: Infinity }
                );
              }
            }
            timersRef.current.delete(queryHash);
          }, SLOW_THRESHOLD_MS);

          timersRef.current.set(queryHash, timer);
        }
      }
    });

    return () => {
      unsubscribe();
      // Cleanup all timers
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, [queryClient]);

  return null; // No visual output -- uses toast system
}
```

**Add to `apps/web/modules/shared/components/ApiClientProvider.tsx`:**

```typescript
import { SlowQueryObserver } from "@/components/SlowQueryObserver";

export function ApiClientProvider({ children }: PropsWithChildren) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SlowQueryObserver />
      {children}
    </QueryClientProvider>
  );
}
```

---

## Phase 3: Maintenance Mode & Graceful Degradation

Two maintenance mode triggers: env var (always works, even when DB is down) and admin dashboard toggle (database-backed, for planned maintenance).

### 3.1 Add Maintenance Mode Configuration

**Update `config/types.ts`:**

Add maintenance type to the Config type:

```typescript
export type Config = {
  // ... existing types ...
  
  maintenance: {
    enabled: boolean;
    message: string;
    allowedEmails: string[];
    estimatedEndTime?: string;
  };
};
```

**Update `config/index.ts`:**

Add maintenance block to the config object (before `as const satisfies Config`):

```typescript
  maintenance: {
    enabled: process.env.MAINTENANCE_MODE === 'true',
    message: process.env.MAINTENANCE_MESSAGE ?? 
      "We're performing scheduled maintenance. We'll be back shortly!",
    allowedEmails: process.env.MAINTENANCE_ALLOWED_EMAILS?.split(',') ?? [],
    estimatedEndTime: process.env.MAINTENANCE_END_TIME,
  },
```

### 3.2 Update Proxy with Maintenance Mode Check

**Update `apps/web/proxy.ts`:**

Add maintenance mode check at the top of the proxy function. The app uses `proxy.ts` as its middleware (not `middleware.ts`).

```typescript
import { config as appConfig } from "@repo/config";

export default async function proxy(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  // --- Maintenance Mode Check ---
  // Skip for health check, static assets, and the maintenance page itself
  const maintenanceBypass = [
    '/api/health',
    '/api/auth',
    '/_next',
    '/favicon',
    '/images',
    '/maintenance',
  ];

  const isMaintenanceBypass = maintenanceBypass.some(path => 
    pathname.startsWith(path)
  );

  // Marketing pages stay accessible during maintenance
  const isProtectedPath = pathname.startsWith('/app') || 
                          pathname.startsWith('/auth') || 
                          pathname.startsWith('/onboarding') ||
                          pathname.startsWith('/admin');

  if (appConfig.maintenance.enabled && isProtectedPath && !isMaintenanceBypass) {
    // Allow specific emails to bypass (for testing)
    const sessionCookie = getSessionCookie(req);
    // Note: can't easily check email in middleware without DB call
    // Allowed emails bypass is best-effort via the maintenance page itself
    return NextResponse.redirect(new URL('/maintenance', origin));
  }

  // ... rest of existing proxy logic ...
}
```

### 3.3 Create Maintenance Page

**Create `apps/web/app/maintenance/page.tsx`:**

```typescript
import { config } from "@repo/config";
import { Button } from "@ui/components/button";
import { Construction, Clock } from "lucide-react";

export default function MaintenancePage() {
  const { message, estimatedEndTime } = config.maintenance;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <Construction className="h-16 w-16 text-primary mb-6" />
      
      <h1 className="text-3xl font-bold mb-4 text-center">
        Scheduled Maintenance
      </h1>
      
      <p className="text-lg text-center text-muted-foreground max-w-md mb-6">
        {message}
      </p>

      {estimatedEndTime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Clock className="h-4 w-4" />
          <span>Expected back by: {new Date(estimatedEndTime).toLocaleString()}</span>
        </div>
      )}

      <Button 
        variant="outline" 
        onClick={() => window.location.reload()}
      >
        Check Again
      </Button>

      <p className="mt-8 text-xs text-muted-foreground">
        Questions? Contact us at support@lifepreneur.com
      </p>
    </div>
  );
}
```

### 3.4 Create Admin Maintenance Mode Controls

**Create `apps/web/app/(admin)/admin/maintenance/page.tsx`:**

An admin page for managing maintenance mode. Since the env var approach requires a Vercel redeploy, this page provides:

1. Current maintenance status display
2. Instructions for enabling/disabling via Vercel
3. Quick-reference CLI commands

For planned maintenance (when DB is available), an admin API endpoint toggles a database flag. The proxy checks the env var first (emergency), then the database flag (planned).

**Database approach for planned maintenance:**

Add to Prisma schema:

```prisma
model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("system_setting")
}
```

**Create `apps/web/app/api/admin/maintenance/route.ts`:**

Admin-only API to toggle maintenance mode via database flag.

```typescript
import { db } from "@repo/database";
import { getSession } from "@saas/auth/lib/server";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const setting = await db.systemSetting.findUnique({
    where: { key: 'maintenance_mode' },
  });

  return NextResponse.json({
    enabled: setting?.value === 'true',
    updatedAt: setting?.updatedAt || null,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const enabled = Boolean(body.enabled);

  await db.systemSetting.upsert({
    where: { key: 'maintenance_mode' },
    create: { key: 'maintenance_mode', value: String(enabled) },
    update: { value: String(enabled) },
  });

  return NextResponse.json({ enabled });
}
```

**Update proxy.ts maintenance check to also check DB flag:**

```typescript
// In proxy.ts, after env var check:
// For planned maintenance, also check DB flag (with error handling -- if DB is down, skip this check)
if (!appConfig.maintenance.enabled && isProtectedPath && !isMaintenanceBypass) {
  try {
    const baseUrl = req.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/admin/maintenance`, {
      headers: { cookie: req.headers.get('cookie') || '' },
      next: { revalidate: 30 }, // Cache for 30 seconds
    });
    if (res.ok) {
      const data = await res.json();
      if (data.enabled) {
        return NextResponse.redirect(new URL('/maintenance', origin));
      }
    }
  } catch {
    // DB is down -- skip DB-based maintenance check, env var is the fallback
  }
}
```

**Admin maintenance page UI** displays current status, toggle button, and instructions for the env var fallback.

### 3.5 Create Auth Error Handler

**Create `apps/web/components/AuthErrorDisplay.tsx`:**

```typescript
"use client";

import { Alert, AlertDescription, AlertTitle } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import { AlertCircle, Home } from "lucide-react";
import { useRouter } from "next/navigation";

interface AuthErrorDisplayProps {
  error: {
    code?: string;
    message: string;
  };
}

export function AuthErrorDisplay({ error }: AuthErrorDisplayProps) {
  const router = useRouter();

  const isDatabaseError = error.message.toLowerCase().includes('database') ||
                          error.message.toLowerCase().includes('connection');

  if (isDatabaseError) {
    return (
      <Alert variant="error" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to sign in right now</AlertTitle>
        <AlertDescription className="mt-2 space-y-2">
          <p>
            We're experiencing temporary technical issues. Please try again in a few minutes.
          </p>
          <p className="text-xs">
            Still having trouble? Email support@lifepreneur.com
          </p>
        </AlertDescription>
        <div className="mt-4 flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.refresh()}
          >
            Try Again
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => router.push('/')}
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Alert variant="error" className="max-w-md">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Sign in failed</AlertTitle>
      <AlertDescription>
        {error.message}
      </AlertDescription>
    </Alert>
  );
}
```

---

## Phase 4: Sentry Monitoring & Health Status

Sentry replaces the custom email alert system. It provides push notifications, error grouping, stack traces, and alerting rules -- all managed externally with zero custom infrastructure.

### 4.1 Install and Configure Sentry SDK

**Install:**

```bash
pnpm add @sentry/nextjs --filter=web
```

**Create `apps/web/instrumentation-client.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  enableLogs: true,

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions in production
  
  // Only send errors in production
  enabled: process.env.NODE_ENV === 'production',
});
```

**Create `apps/web/sentry.server.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  enableLogs: true,

  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  tracesSampleRate: 0.1,
  
  enabled: process.env.NODE_ENV === 'production',
});
```

**Create `apps/web/sentry.edge.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  enableLogs: true,

  tracesSampleRate: 0.1,
  
  enabled: process.env.NODE_ENV === 'production',
});
```

### 4.2 Update next.config.ts

**Update `apps/web/next.config.ts`:**

Wrap the existing config export with `withSentryConfig`. Also update the CSP to allow Sentry's ingest domain.

```typescript
import { withSentryConfig } from "@sentry/nextjs";

// ... existing config ...

// Update CSP connect-src to include Sentry:
// "connect-src 'self' blob: https://*.supabase.co https://*.stripe.com https://r.wdfl.co https://*.ingest.sentry.io",

export default withSentryConfig(
  withContentCollections(withNextIntl(nextConfig)),
  {
    // Sentry webpack plugin options
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    
    // Suppress source map upload logs
    silent: !process.env.CI,
    
    // Upload source maps for readable stack traces
    widenClientFileUpload: true,
    
    // Hide source maps from users
    hideSourceMaps: true,
    
    // Tree-shake Sentry logger in production
    disableLogger: true,
  }
);
```

### 4.3 Integrate Sentry with Error Wrapper

The error wrapper (Phase 1.1) already includes `Sentry.captureException`. Additionally, add Sentry spans to the database wrapper for performance tracing:

```typescript
// In wrapDatabaseQuery:
export async function wrapDatabaseQuery<T>(
  queryFn: () => Promise<T>,
  context: { operation: string; userId?: string; route?: string; }
): Promise<{ data?: T; error?: UserFriendlyError }> {
  return Sentry.startSpan(
    {
      op: "db.query",
      name: context.operation,
    },
    async (span) => {
      try {
        const data = await queryFn();
        span.setAttribute("db.success", true);
        return { data };
      } catch (error) {
        span.setAttribute("db.success", false);
        // ... existing error handling with Sentry.captureException ...
      }
    }
  );
}
```

### 4.4 Add Health Status Indicator to Admin Sidebar

**Update `apps/web/modules/saas/admin/component/AdminSidebar.tsx`:**

Add a small health dot that polls `/api/health` every 60 seconds. Green = healthy, red = issues. Clicking it links to Sentry dashboard.

```typescript
// Add HealthIndicator component within AdminSidebar:
function HealthIndicator() {
  const [status, setStatus] = useState<'healthy' | 'unhealthy' | 'checking'>('checking');

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/health');
        setStatus(res.ok ? 'healthy' : 'unhealthy');
      } catch {
        setStatus('unhealthy');
      }
    }

    check();
    const interval = setInterval(check, 60000); // Every 60 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className={cn(
        "h-2 w-2 rounded-full",
        status === 'healthy' && "bg-green-500",
        status === 'unhealthy' && "bg-red-500 animate-pulse",
        status === 'checking' && "bg-yellow-500",
      )} />
      <span>System {status === 'healthy' ? 'Healthy' : status === 'checking' ? 'Checking...' : 'Issues Detected'}</span>
    </div>
  );
}
```

Place in the `SidebarFooter` area above the version info.

---

## Environment Variables

Add to Vercel environment variables:

```bash
# Sentry (already configured)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o123.ingest.sentry.io/456
SENTRY_AUTH_TOKEN=your_auth_token_here
SENTRY_ORG=your-org-name
SENTRY_PROJECT=your-project-name

# Maintenance Mode
MAINTENANCE_MODE=false
MAINTENANCE_MESSAGE="We're performing scheduled maintenance. We'll be back shortly!"
MAINTENANCE_ALLOWED_EMAILS="your-email@example.com"
MAINTENANCE_END_TIME=""  # ISO 8601 format when needed

# Cron Secret (already exists from GDPR plan)
CRON_SECRET=your_existing_cron_secret_here
```

---

## Testing Checklist

After implementation, test thoroughly on Vercel preview:

### Error Handling Tests

- Visit content page -- verify it loads normally with no errors
- Verify DatabaseErrorBoundary doesn't interfere with normal operation
- Check Sentry dashboard receives test error (trigger one manually)
- Verify "Try Again" button works on error boundaries

### Retry Logic Tests

- Verify QueryClient retry config is active (check React Query devtools or logs)
- Confirm queries don't retry on 404s or validation errors
- Confirm queries do retry on connection/timeout errors (can simulate by temporarily blocking Supabase)

### Slow Loading Tests

- Verify slow loading toast appears if a query takes >8 seconds
- Verify toast dismisses when query completes
- Verify no toast for fast queries

### Maintenance Mode Tests

- Set MAINTENANCE_MODE=true in Vercel env vars and redeploy
- Verify app pages redirect to maintenance page
- Verify marketing pages still load during maintenance
- Verify `/api/health` endpoint still works during maintenance
- Verify maintenance page shows message and "Check Again" button
- Set MAINTENANCE_MODE=false and redeploy to disable
- Test admin database toggle (if DB is available)

### Auth Error Tests

- Verify AuthErrorDisplay shows friendly message for database errors
- Verify normal auth errors show standard messages

### Sentry Integration Tests

- Verify errors appear in Sentry dashboard with correct tags and context
- Verify source maps work (readable stack traces, not minified)
- Test alert rules fire (trigger enough errors to cross threshold)
- Verify Sentry email/Discord notifications arrive

### Health Indicator Tests

- Verify green dot shows in admin sidebar when system is healthy
- Verify latency is reasonable (<500ms)

---

## Deployment Notes

### Pre-Launch Checklist (for 400-Member Migration)

1. **Configure Sentry Alerts**
  - Set up alert rule: "10+ errors in 5 minutes" → email notification
  - Optional: Connect Sentry to Discord for real-time alerts
2. **Test Maintenance Mode Flow**
  - Practice enabling/disabling via Vercel env vars
  - Verify marketing pages work while in maintenance
3. **Document Runbook**
  - How to enable maintenance mode quickly (Vercel dashboard)
  - How to check health endpoint
  - How to check Sentry dashboard for errors
  - How to check Supabase status
  - Support contact procedures

### Migration Day Procedure

1. **Before Migration:**
  - Set `MAINTENANCE_MODE=true` in Vercel env vars
  - Set `MAINTENANCE_MESSAGE="We're upgrading to serve you better! Back in 15 minutes."`
  - Set `MAINTENANCE_END_TIME` to estimated completion time (ISO 8601)
  - Deploy to activate maintenance mode
2. **During Migration:**
  - Run database migrations
  - Test health endpoint returns healthy
  - Test login with test account
  - Test content access with test account
3. **After Migration:**
  - Set `MAINTENANCE_MODE=false` in Vercel env vars
  - Deploy to deactivate maintenance mode
  - Announce in Discord that platform is live
  - Monitor Sentry for errors over next 2 hours
  - Watch admin sidebar health indicator

---

## Architecture Diagram

```mermaid
flowchart TB
    User[User Request]
    Proxy[Proxy Middleware]
    Maintenance[Maintenance Page]
    App[Application]
    DBWrapper[Database Wrapper]
    DB[(Supabase Database)]
    ErrorBoundary[DatabaseErrorBoundary]
    Sentry[Sentry]
    QueryClient[QueryClient - Smart Retry]
    SlowObserver[Slow Query Observer]
    HealthDot[Admin Health Indicator]
    HealthAPI[/api/health]
    
    User --> Proxy
    Proxy -->|Maintenance On| Maintenance
    Proxy -->|Maintenance Off| App
    App --> QueryClient
    QueryClient -->|Retry on timeout/connection| DBWrapper
    QueryClient --> SlowObserver
    SlowObserver -->|>8s| User
    DBWrapper -->|Query| DB
    DB -->|Success| App
    DB -->|Error| DBWrapper
    DBWrapper -->|Report| Sentry
    DBWrapper -->|Friendly Message| ErrorBoundary
    ErrorBoundary -->|Report| Sentry
    ErrorBoundary --> User
    HealthDot --> HealthAPI
    HealthAPI --> DB
    Sentry -->|Alert| AdminEmail[Admin Email/Discord]
    
    style DB fill:#ff6b6b
    style Sentry fill:#362d59,color:#fff
    style Maintenance fill:#a8dadc
    style ErrorBoundary fill:#ffd93d
```



---

## Success Metrics

After launch, monitor:

1. **Error Rate:** Target <0.1% of requests result in database errors (tracked in Sentry)
2. **Sentry Alert Frequency:** Should be zero under normal conditions
3. **User Complaints:** Reduction in "I can't access content" support tickets
4. **Retry Success Rate:** Check Sentry for "retried and succeeded" vs "retried and failed" patterns
5. **Health Indicator:** Should be green 99.9% of the time
6. **Maintenance Mode Usage:** Document each usage and duration

---

## Lessons Applied from GDPR Plan

1. **Verify page paths before wrapping** -- content, community, and billing pages exist at the paths specified
2. **Config paths are `config/index.ts` and `config/types.ts**` (root level, not `packages/config/`)
3. **The app uses `proxy.ts` not `middleware.ts**` for middleware logic
4. **Button variants use `variant="error"` not `variant="destructive"**` in this codebase
5. **Vercel cron jobs only register on production** -- test accordingly
6. **Preview deployments have Deployment Protection** -- use browser testing, not curl
7. **Always run `pnpm install` after adding packages** to refresh monorepo links
8. **Migration should be created and applied properly** if schema changes are needed (SystemSetting model)

