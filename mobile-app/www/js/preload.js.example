// Build-time preload seed -- canonical no-op stub.
//
// The build script (mobile-app/scripts/build-preloaded.js) overwrites
// `preload.js` (the file actually loaded by index.html) with seeded values
// drawn from MEMBER_ID, GRAYLOG_URL, GRAYLOG_TOKEN, and an optional
// COMMON_DASHBOARD_ID, then restores it from this `.example` after the
// `cordova build` step so the working tree stays clean.
//
// Loaded *before* users.js / app.js (see index.html), it pre-populates the
// localStorage keys those scripts read so a freshly-installed APK opens
// straight to the dashboard with no Sign-in or Settings prompts.
//
// Behaviour:
//   - Only writes a key if it isn't already set (so a user who has overridden
//     a value isn't clobbered on app upgrade).
//   - When `enabled: false` (the committed example below) it's a no-op, so
//     `cordova build android` still produces a working stock APK.
(function () {
  'use strict';
  var SEED = {
    enabled: false,
    auth:     { userId: null },                                // tok-scrape.auth.v1
    settings: { url: '', token: '',                            // tok-scrape.settings.v1
                query: 'source:tiktok-bookmarklet', autoRefresh: true },
    common:   { enabled: false, name: 'Seller Comparison',     // tok-scrape.commonDashboard.v1
                graylogDashboardId: '' }
  };
  if (!SEED.enabled) return;
  var setIfMissing = function (k, v) {
    try { if (localStorage.getItem(k) == null) localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { /* private mode / quota -- the app handles it */ }
  };
  if (SEED.auth && SEED.auth.userId)   setIfMissing('tok-scrape.auth.v1',            SEED.auth);
  if (SEED.settings && SEED.settings.url) setIfMissing('tok-scrape.settings.v1',     SEED.settings);
  if (SEED.common && SEED.common.enabled) setIfMissing('tok-scrape.commonDashboard.v1', SEED.common);
})();
