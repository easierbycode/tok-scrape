import { define } from "../../../utils.ts";

/**
 * Port of `apps/web/app/(saas)/app/layout.tsx`.
 *
 * The original calls `getSession()`, `getOrganizationList()`, `getPurchases()`
 * and redirects to `/auth/login`, `/onboarding`, `/new-organization`, or
 * `/choose-plan`. Those depend on Better Auth + Prisma which aren't wired up
 * here yet — replace this stub with real session/billing checks (or a Deno
 * port of `@repo/auth`) when porting auth.
 */
export default define.layout(({ Component }) => {
  return (
    <>
      {/* <ImpersonationBanner /> — port from @saas/admin when needed */}
      <div class="saas-app-shell">
        <div class="saas-app-shell-container">
          {/* <NotificationBanner /> — port from @saas/shared when needed */}
        </div>
        <Component />
      </div>
      <style>
        {`
          .saas-app-shell {
            padding-top: 0;
            min-height: 100vh;
            background:
              radial-gradient(
                farthest-corner at 0% 0%,
                color-mix(in oklch, #f54e00, transparent 90%) 0%,
                #1a1916 50%
              );
          }
          @media (min-width: 1024px) {
            .saas-app-shell { padding-top: 2rem; }
          }
          .saas-app-shell-container {
            max-width: 1280px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 1rem;
            padding-right: 1rem;
          }
        `}
      </style>
    </>
  );
});
