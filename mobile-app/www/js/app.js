// App bootstrap: scope selector, settings, refresh loop, error handling.
//
// Scope model (see users.js for the roster):
//   - The dashboard is scoped to one of:
//       * '__all'      -- aggregate every creator
//       * ['id', ...]  -- one or more roster ids; non-empty
//     Selection persists in localStorage under tok-scrape.auth.v1.
//   - The Account selector in the topbar drives the scope. "All Accounts" is
//     a one-tap aggregate; individual rows toggle on/off so multiple creators
//     can be active at once. The Graylog query OR-joins multi-creator scopes.
//   - There is no "sign in" prompt -- the app opens straight to the dashboard
//     using the persisted (or preloaded) scope.
//   - The build-time preload (scripts/build-preloaded.js) seeds the scope to
//     the first MEMBER_ID so a freshly-installed APK lands on that creator
//     by default; the user can broaden the scope via the selector.
//   - Admin-only menu (Login As / Sign Out) is only rendered when
//     Users.isAdmin() returns true; it remains a quiet escape hatch for the
//     legacy admin flow.

(function () {
  'use strict';

  var SETTINGS_KEY    = 'tok-scrape.settings.v1';
  var COMMON_DASH_KEY = 'tok-scrape.commonDashboard.v1';
  var MODE_KEY        = 'tok-scrape.mode.v1';   // 'videos' | 'live'
  var els = {};
  var autoTimer = null;
  var loading = false;
  var routeLock = null;
  var commonDashSessionPromise = null;          // memoizes establishSession() per app run

  // -------- Settings persistence -----------------------------------

  function $(id) { return document.getElementById(id); }

  // Default GELF HTTP input endpoint, matching the browser extensions
  // (extension-seller/config.js). The bookmarklet-sync sidecar in
  // docker-compose.yml rewrites this on every `docker compose up`.
  var DEFAULT_GRAYLOG_URL = 'https://tok-graylog-api.ngrok-free.dev';
  var DEFAULT_GRAYLOG_TOKEN = '1hjk2lkmmgqh8gqbint3fneasc2hn208jrf28hd7gsfv9j6s9amr';
  var DEFAULT_GELF_URL = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';
  // Bump this key whenever DEFAULT_GRAYLOG_TOKEN is rotated (or needs to be
  // re-pushed to installs that already ran an earlier migration). loadSettings()
  // only re-applies the embedded token to an install once per key value, so a
  // version bump is what makes the refresh reach devices that migrated before.
  var GRAYLOG_TOKEN_MIGRATION_KEY = 'tok-scrape.graylogToken.v4';

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      var query = s.query || 'source:tiktok-bookmarklet';
      // Migrate the old broken default: Graylog indexes GELF `host` as `source`,
      // so `host:tiktok-bookmarklet` never matched any message. Rewrite silently.
      if (query === 'host:tiktok-bookmarklet') query = 'source:tiktok-bookmarklet';
      var url = (s.url || '').replace(/\/+$/, '');
      // Repair a base URL pointed at the GELF *ingest* endpoint. That host only
      // accepts writes (the bookmarklet posts there); the dashboard reads from
      // the REST API host, so a misseeded URL makes every search 401 no matter
      // how valid the token is. Rewrite it to the API default so the install
      // recovers without a manual Settings edit.
      if (url === DEFAULT_GELF_URL || url === DEFAULT_GELF_URL.replace(/\/gelf$/, '')) {
        url = DEFAULT_GRAYLOG_URL;
      }
      var migratedToken = s.token || '';
      var tokenMigrationApplied = localStorage.getItem(GRAYLOG_TOKEN_MIGRATION_KEY) === '1';
      if (url === DEFAULT_GRAYLOG_URL &&
          migratedToken !== DEFAULT_GRAYLOG_TOKEN &&
          !tokenMigrationApplied) {
        migratedToken = DEFAULT_GRAYLOG_TOKEN;
        localStorage.setItem(GRAYLOG_TOKEN_MIGRATION_KEY, '1');
      }
      var migrated = {
        url:         url,
        token:       migratedToken,
        query:       query,
        gelfUrl:     s.gelfUrl     || DEFAULT_GELF_URL,
        autoRefresh: !!s.autoRefresh
      };
      if (migrated.url !== s.url ||
          migrated.token !== s.token ||
          migrated.query !== s.query ||
          migrated.gelfUrl !== s.gelfUrl) saveSettings(migrated);
      return migrated;
    } catch (e) { return defaults(); }
  }
  function defaults() {
    return { url: DEFAULT_GRAYLOG_URL, token: DEFAULT_GRAYLOG_TOKEN, query: 'source:tiktok-bookmarklet', gelfUrl: DEFAULT_GELF_URL, autoRefresh: false };
  }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  // -------- Mode (videos | live) -----------------------------------

  function getMode() {
    try {
      var v = localStorage.getItem(MODE_KEY);
      return v === 'live' ? 'live' : 'videos';
    } catch (e) { return 'videos'; }
  }
  function setMode(m) {
    var mode = m === 'live' ? 'live' : 'videos';
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
    document.body.setAttribute('data-mode', mode);
    document.querySelectorAll('#modeToggle .mode-btn').forEach(function (btn) {
      var on = btn.getAttribute('data-mode') === mode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  // Hide the toggle entirely when the current scope only has one shape of
  // data (videos OR live, but not both). refresh() decides this based on
  // the parallel probe of both Graylog sources.
  function setToggleVisibility(visible) {
    var t = document.getElementById('modeToggle');
    if (!t) return;
    t.classList.toggle('hidden', !visible);
  }

  // Show or hide every section tagged data-mode="affiliate".
  function setAffiliateBlockVisibility(visible) {
    document.querySelectorAll('.affiliate-block').forEach(function (el) {
      el.classList.toggle('hidden', !visible);
    });
  }

  // Collapse the dashboard to just the Data Overview card. Used on the "Today"
  // range — daily charts and tables aren't meaningful for a single point, so
  // we surface the overview KPI tiles only.
  //
  // Scoped to section[data-mode] (the per-mode card sections). A bare
  // [data-mode] selector also matches <body data-mode="videos"> — hiding the
  // body via .hidden { display:none !important } blanks the whole page.
  function setTodayOnlyMode(on) {
    document.querySelectorAll('section[data-mode], .affiliate-block, #modeToggle')
      .forEach(function (el) { el.classList.toggle('hidden', on); });
  }

  function loadCommonDashConfig() {
    try {
      var raw = localStorage.getItem(COMMON_DASH_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.enabled || !parsed.graylogDashboardId) return null;
      return {
        enabled: true,
        name: parsed.name || 'Seller Comparison',
        graylogDashboardId: String(parsed.graylogDashboardId)
      };
    } catch (e) { return null; }
  }

  // -------- UI helpers --------------------------------------------

  function showError(msg) {
    if (!msg) { els.err.classList.add('hidden'); return; }
    els.err.textContent = msg;
    els.err.classList.remove('hidden');
    clearTimeout(showError._t);
    showError._t = setTimeout(function () { els.err.classList.add('hidden'); }, 6000);
  }

  function showEmpty(yes, msg) {
    // Never display:none the whole #dashboard — that would also hide the
    // always-on Campaign Manager / Daily Goal card (it renders from local mock
    // data and must stay visible even with zero Graylog results). Instead, hide
    // only the data-dependent cards via the .no-data class (see css/app.css).
    setNoData(!!yes);
    els.empty.classList.toggle('hidden', !yes);
    if (yes && msg) $('emptyStateMsg').textContent = msg;
    syncRouteFromScroll();
  }

  // Toggle the "no data" state on #dashboard. CSS hides every card EXCEPT the
  // Campaign Manager (.campaign-manager) plus the mode toggle, so the campaign /
  // daily-goal card is always on screen.
  function setNoData(on) {
    if (els.dashboard) els.dashboard.classList.toggle('no-data', !!on);
  }

  // Slim, non-error notice rendered just under the Campaign Manager card. Used
  // to tell the user when the visible window was auto-widened (their selected
  // range had no data) or when there are no scrapes at all. Created at runtime
  // because OTA bundles ship JS/CSS only — index.html is whatever the installed
  // APK carries, so we can't rely on the element existing in markup.
  function ensureNoticeEl() {
    var n = document.getElementById('rangeNotice');
    if (n) return n;
    var dash = els.dashboard || document.getElementById('dashboard');
    if (!dash) return null;
    n = document.createElement('div');
    n.id = 'rangeNotice';
    n.className = 'range-notice hidden';
    n.setAttribute('role', 'status');
    n.setAttribute('aria-live', 'polite');
    var card = document.getElementById('activeCampaignsCard');
    if (card && card.nextSibling) dash.insertBefore(n, card.nextSibling);
    else if (card)                dash.appendChild(n);
    else                          dash.insertBefore(n, dash.firstChild);
    return n;
  }
  function showNotice(msg) {
    var n = ensureNoticeEl();
    if (!n) return;
    n.textContent = msg;
    n.classList.remove('hidden');
  }
  function hideNotice() {
    var n = document.getElementById('rangeNotice');
    if (n) n.classList.add('hidden');
  }

  function setRoute(route) {
    document.body.setAttribute('data-route', route || 'home');
  }

  function lockRoute(route) {
    routeLock = route || 'home';
    setRoute(routeLock);
  }

  function unlockRoute() {
    routeLock = null;
    syncRouteFromScroll();
  }

  function currentStickyOffset() {
    return els.topbar ? els.topbar.offsetHeight + 20 : 96;
  }

  function scrollToY(top) {
    top = Math.max(0, top);
    try {
      window.scrollTo({ top: top, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, top);
    }
  }

  function scrollToSection(el, route) {
    if (!el) return;
    routeLock = null;
    setRoute(route);
    scrollToY(el.getBoundingClientRect().top + window.scrollY - currentStickyOffset());
  }

  function activeCampaignsSection() {
    return getMode() === 'live'
      ? document.getElementById('liveCampaignsSection')
      : document.getElementById('campaignsSection');
  }

  // -------- Active Campaigns (mock data) --------------------------
  //
  // Mirror of the Next.js active-campaigns.tsx component from the web
  // member-app. Until the campaign API is wired up we render a fixed
  // set of rows so the card is never empty. Replace MOCK_CAMPAIGNS with
  // a live fetch (e.g. via api.js) when the backend is available.
  //
  // contributions: per-creator video counts. The campaign ring renders one
  // segment per required video, with the first N segments (N = sum of
  // contributions, capped at postsRequired) colored by their contributing
  // creator's deterministic colorFor() hue. Remaining segments use the
  // track color. Until the campaign API is wired up, contributions are
  // stubbed below — replace with a live fetch when the backend ships.

  var MOCK_CAMPAIGNS = [
    { id: '1', brand: 'StyleCo Fashion', postsRequired: 5, daysLeft: 3,
      contributions: [
        { creator: '@boosteddealsdaily', count: 2 },
        { creator: '@prettyplug.x',      count: 1 }
      ] },
    { id: '2', brand: 'TechGear Pro',    postsRequired: 8, daysLeft: 12,
      contributions: [
        { creator: '@wizardofdealz',     count: 2 }
      ] },
    { id: '3', brand: 'BeautyGlow',      postsRequired: 6, daysLeft: 21,
      contributions: [
        { creator: '@boosteddealsdaily', count: 2 },
        { creator: '@prettyplug.x',      count: 1 },
        { creator: '@wizardofdealz',     count: 1 }
      ] }
  ];

  // Map "@handle" → the per-creator hue used elsewhere in the UI
  // (acct-dot, chart series, ring segments).
  function colorForHandle(handle) {
    var id = String(handle || '').replace(/^@+/, '').toLowerCase();
    return id ? colorFor(id) : 'rgba(242,241,237,0.18)';
  }

  // Sum of contribution counts, capped at postsRequired so the ring
  // never overshoots and percentages stay ≤ 100%.
  function postsCompletedOf(c) {
    var s = 0;
    (c.contributions || []).forEach(function (x) { s += Math.max(0, x.count | 0); });
    return Math.min(s, c.postsRequired || 0);
  }

  // Multi-color segmented ring for a campaign card. One arc per required
  // video — filled segments take their contributor's color, in order;
  // remaining segments use the faint track color. Centered % readout.
  function campaignRingSvg(c) {
    var total  = Math.max(1, c.postsRequired | 0);
    var size   = 40;
    var stroke = 4;
    var r      = (size - stroke) / 2;
    var cx     = size / 2, cy = size / 2;
    var circ   = 2 * Math.PI * r;
    var seg    = circ / total;
    var gap    = Math.max(2, seg * 0.18);
    var arc    = Math.max(0.5, seg - gap);

    var fills = [];
    (c.contributions || []).forEach(function (ctr) {
      var color = colorForHandle(ctr.creator);
      for (var i = 0; i < (ctr.count | 0) && fills.length < total; i++) {
        fills.push(color);
      }
    });

    var segsSvg = '';
    for (var i = 0; i < total; i++) {
      var color = fills[i] || 'rgba(242,241,237,0.10)';
      segsSvg +=
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
        ' fill="none" stroke="' + color + '" stroke-width="' + stroke + '"' +
        ' stroke-dasharray="' + arc.toFixed(2) + ' ' + (circ - arc).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-(i * seg)).toFixed(2) + '"' +
        ' stroke-linecap="round" />';
    }

    var done = postsCompletedOf(c);
    var pct  = c.postsRequired > 0 ? Math.round((done / c.postsRequired) * 100) : 0;
    var pctColor = pct >= 100 ? 'var(--success)' : 'var(--foreground)';

    return ''
      + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">'
      +   '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">' + segsSvg + '</g>'
      +   '<text x="' + cx + '" y="' + (cy + 0.5) + '" text-anchor="middle" dominant-baseline="central"'
      +     ' font-family="\'Avenir Next\',\'SF Pro Text\',sans-serif" font-size="10.5" font-weight="700"'
      +     ' fill="' + pctColor + '">' + pct + '%</text>'
      + '</svg>';
  }

  // ── Campaign Manager: dual-metric progress (Campaigns ⇄ Daily Goal) ──
  //
  // The card shows a single combined multi-account progress bar. A dropdown
  // switches the bar between two metrics — Active Campaigns and Daily Goal —
  // and the card auto-cycles between them every 5.5s. Expanding the card (⤡)
  // slides open the per-account/per-campaign breakdown: that expansion IS the
  // "split" view, and the collapsed summary bar is the "combined" one (so the
  // old standalone Combine toggle is gone). See mountCampaignManager() below.

  // Average of each campaign's individual completion percentage. Rounded
  // to an integer for display. Returns 0 for an empty list.
  function avgCampaignPct(list) {
    if (!list || !list.length) return 0;
    var sum = 0;
    list.forEach(function (c) {
      var req = c.postsRequired || 0;
      if (!req) return;
      sum += (postsCompletedOf(c) / req) * 100;
    });
    return Math.round(sum / list.length);
  }

  // ── Daily Goal ────────────────────────────────────────────────────
  //
  // The second metric. Each tracked account has a daily video goal
  // (default 5) and a posted-count 0–5. Same multi-account colored bar and
  // split/combine (collapse/expand) treatment as campaigns. Posted counts
  // are mock until a real "videos posted today" rollup exists — replace
  // GOAL_ACCOUNTS with a live fetch when the backend ships (mirrors the
  // MOCK_CAMPAIGNS note above).
  var DAILY_GOAL = 5;
  var GOAL_ACCOUNTS = [
    { creator: '@boosteddealsdaily', posted: 4, goal: DAILY_GOAL },
    { creator: '@prettyplug.x',      posted: 5, goal: DAILY_GOAL },
    { creator: '@wizardofdealz',     posted: 2, goal: DAILY_GOAL }
  ];

  // Per-account segmented ring: `goal` beads, `posted` of them filled in
  // the account's color; center shows the posted count (green once met).
  function goalRingSvg(posted, goal, color) {
    var total  = Math.max(1, goal | 0);
    var size   = 40;
    var stroke = 4;
    var r      = (size - stroke) / 2;
    var cx     = size / 2, cy = size / 2;
    var circ   = 2 * Math.PI * r;
    var seg    = circ / total;
    var gap    = Math.max(2, seg * 0.18);
    var arc    = Math.max(0.5, seg - gap);
    var met    = posted >= goal;

    var segsSvg = '';
    for (var i = 0; i < total; i++) {
      var fill = i < posted ? (color || 'var(--primary)') : 'rgba(242,241,237,0.10)';
      segsSvg +=
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"' +
        ' fill="none" stroke="' + fill + '" stroke-width="' + stroke + '"' +
        ' stroke-dasharray="' + arc.toFixed(2) + ' ' + (circ - arc).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-(i * seg)).toFixed(2) + '"' +
        ' stroke-linecap="round" />';
    }

    return ''
      + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">'
      +   '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">' + segsSvg + '</g>'
      +   '<text x="' + cx + '" y="' + (cy + 0.5) + '" text-anchor="middle" dominant-baseline="central"'
      +     ' font-family="\'Avenir Next\',\'SF Pro Text\',sans-serif" font-size="12" font-weight="700"'
      +     ' fill="' + (met ? 'var(--success)' : 'var(--foreground)') + '">' + posted + '</text>'
      + '</svg>';
  }

  function goalRowHtml(a) {
    var color = colorForHandle(a.creator);
    var met   = a.posted >= a.goal;
    var w     = a.goal > 0 ? (a.posted / a.goal) * 100 : 0;

    return ''
      + '<li class="campaign-row" role="button" tabindex="0">'
      +   '<span class="campaign-icon campaign-icon--ring" aria-hidden="true">'
      +     goalRingSvg(a.posted, a.goal, color)
      +   '</span>'
      +   '<div class="campaign-main">'
      +     '<div class="campaign-headline">'
      +       '<span class="campaign-brand">' + escapeHtml(a.creator) + '</span>'
      +       '<span class="campaign-deadline campaign-goalcap">'
      +         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +           '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>'
      +         '</svg>'
      +         (met ? 'Goal met' : 'Goal ' + a.goal + '/day')
      +       '</span>'
      +     '</div>'
      +     '<div class="campaign-progress">'
      +       '<span class="campaign-bar"><span class="campaign-bar-slice" style="width:'
      +         w.toFixed(2) + '%;background:' + color + '"></span></span>'
      +       '<span class="campaign-count">' + a.posted + '/' + a.goal + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<span class="campaign-chevron" aria-hidden="true">'
      +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      +       '<polyline points="9 6 15 12 9 18"/>'
      +     '</svg>'
      +   '</span>'
      + '</li>';
  }

  // ── Combined summary bars (one per metric) ────────────────────────
  //
  // The always-visible bar at the top of the card. Aggregates every account
  // into a single multi-color bar plus a fixed-width percent readout. Both
  // metrics' readouts are held to the SAME width (.cm-percent in CSS) so
  // switching never reflows the layout or spawns a horizontal scrollbar.
  function campaignsSummaryHtml() {
    var totalReq = 0, perCreator = Object.create(null);
    MOCK_CAMPAIGNS.forEach(function (c) {
      totalReq += c.postsRequired || 0;
      (c.contributions || []).forEach(function (ctr) {
        var k = String(ctr.creator || '').toLowerCase();
        if (!k) return;
        perCreator[k] = (perCreator[k] || 0) + Math.max(0, ctr.count | 0);
      });
    });
    var slices = '';
    Object.keys(perCreator).forEach(function (handle) {
      var n = perCreator[handle];
      var w = totalReq > 0 ? (n / totalReq) * 100 : 0;
      if (w <= 0) return;
      slices +=
        '<span class="campaign-bar-slice" title="' + escapeHtml(handle) + ' · ' + n + '"'
        + ' style="width:' + w.toFixed(2) + '%;background:' + colorForHandle(handle) + '"></span>';
    });
    var avg = avgCampaignPct(MOCK_CAMPAIGNS);
    return ''
      + '<span class="campaign-bar cm-bar">' + slices + '</span>'
      + '<span class="cm-percent">' + avg + '%'
      +   '<span class="cm-percent-sub">avg</span>'
      + '</span>';
  }

  function goalsSummaryHtml() {
    var totalGoal = 0, totalPosted = 0;
    GOAL_ACCOUNTS.forEach(function (a) {
      totalGoal   += a.goal || 0;
      totalPosted += Math.max(0, Math.min(a.posted, a.goal));
    });
    var slices = '';
    GOAL_ACCOUNTS.forEach(function (a) {
      var w = totalGoal > 0 ? (Math.min(a.posted, a.goal) / totalGoal) * 100 : 0;
      if (w <= 0) return;
      slices +=
        '<span class="campaign-bar-slice" title="' + escapeHtml(a.creator) + ' · ' + a.posted + '/' + a.goal + '"'
        + ' style="width:' + w.toFixed(2) + '%;background:' + colorForHandle(a.creator) + '"></span>';
    });
    var pct = totalGoal > 0 ? Math.round((totalPosted / totalGoal) * 100) : 0;
    return ''
      + '<span class="campaign-bar cm-bar">' + slices + '</span>'
      + '<span class="cm-percent">' + pct + '%'
      +   '<span class="cm-percent-sub">' + totalPosted + '/' + totalGoal + '</span>'
      + '</span>';
  }

  // Honour the OS "reduce motion" setting: the expand slide and the row
  // fade are skipped (the final state is committed synchronously regardless,
  // so the card is always correct — just without the motion).
  function cmReduceMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { return false; }
  }

  function campaignRowHtml(c) {
    var completed = postsCompletedOf(c);
    var deadline = c.daysLeft === 0
      ? 'Due today'
      : c.daysLeft + ' day' + (c.daysLeft === 1 ? '' : 's') + ' left';

    // Stacked contribution bar: one slice per contributor, widths
    // proportional to count. Same hues as the ring so the two readings
    // agree at a glance. The trailing track (unfilled remainder of the
    // bar) is the default .campaign-bar background.
    var slices = '';
    (c.contributions || []).forEach(function (ctr) {
      var w = c.postsRequired > 0 ? (ctr.count / c.postsRequired) * 100 : 0;
      if (w <= 0) return;
      slices +=
        '<span class="campaign-bar-slice" title="' + escapeHtml(ctr.creator)
        + ' · ' + ctr.count + '" style="width:' + w.toFixed(2) + '%;background:'
        + colorForHandle(ctr.creator) + '"></span>';
    });

    return ''
      + '<li class="campaign-row" role="button" tabindex="0" data-campaign-id="' + escapeHtml(c.id) + '">'
      +   '<span class="campaign-icon campaign-icon--ring" aria-hidden="true">'
      +     campaignRingSvg(c)
      +   '</span>'
      +   '<div class="campaign-main">'
      +     '<div class="campaign-headline">'
      +       '<span class="campaign-brand">' + escapeHtml(c.brand) + '</span>'
      +       '<span class="campaign-deadline">'
      +         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +           '<circle cx="12" cy="12" r="9"/>'
      +           '<path d="M12 7v5l3 2"/>'
      +         '</svg>'
      +         escapeHtml(deadline)
      +       '</span>'
      +     '</div>'
      +     '<div class="campaign-progress">'
      +       '<span class="campaign-bar">' + slices + '</span>'
      +       '<span class="campaign-count">' + completed + '/' + c.postsRequired + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<span class="campaign-chevron" aria-hidden="true">'
      +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      +       '<polyline points="9 6 15 12 9 18"/>'
      +     '</svg>'
      +   '</span>'
      + '</li>';
  }

  // Skeleton for the Campaign Manager card body. Re-applied on every mount
  // so an OTA bundle upgrades an installed APK's older markup (the static
  // "Campaigns" head + Combine button) to the new dropdown / expand /
  // auto-cycle component regardless of what index.html shipped.
  var CM_SKELETON =
    '<div class="cm-head">' +
      '<div class="cm-metric" data-open="0">' +
        '<button type="button" class="cm-metric-trigger" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="cm-metric-label">Active Campaigns</span>' +
          '<span class="cm-caret" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
          '</span>' +
        '</button>' +
        '<div class="cm-metric-menu" role="listbox" hidden>' +
          '<button type="button" class="cm-metric-opt is-active" role="option" data-metric="campaigns">' +
            '<span>Active Campaigns</span><span class="cm-opt-check" aria-hidden="true">✓</span>' +
          '</button>' +
          '<button type="button" class="cm-metric-opt" role="option" data-metric="goals">' +
            '<span>Daily Goal</span><span class="cm-opt-check" aria-hidden="true">✓</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="cm-expand" aria-expanded="false" aria-label="Expand breakdown">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<polyline points="15 3 21 3 21 9"></polyline>' +
          '<polyline points="9 21 3 21 3 15"></polyline>' +
          '<line x1="21" y1="3" x2="14" y2="10"></line>' +
          '<line x1="3" y1="21" x2="10" y2="14"></line>' +
        '</svg>' +
      '</button>' +
    '</div>' +
    '<div class="cm-summary"></div>' +
    '<div class="cm-detail"><div class="cm-detail-pad"><ul class="cm-rows"></ul></div></div>';

  // Build + wire the Campaign Manager component into `card`. The expand /
  // collapse height (a CSS height transition can't animate to/from `auto`)
  // and the metric reveal are animated with the Web Animations API; the
  // auto-cycle telegraph is CSS. All honour prefers-reduced-motion. The
  // committed final state (inline height, .is-active class) is always set
  // synchronously, so the card is correct even when the motion is skipped.
  function mountCampaignManager(card) {
    card.innerHTML = CM_SKELETON;

    var metricEl  = card.querySelector('.cm-metric');
    var trigger   = card.querySelector('.cm-metric-trigger');
    var label     = card.querySelector('.cm-metric-label');
    var menu      = card.querySelector('.cm-metric-menu');
    var expand    = card.querySelector('.cm-expand');
    var summary   = card.querySelector('.cm-summary');
    var rows      = card.querySelector('.cm-rows');
    var detail    = card.querySelector('.cm-detail');
    var detailPad = card.querySelector('.cm-detail-pad');

    var META = { campaigns: 'Active Campaigns', goals: 'Daily Goal' };
    var EASE = 'cubic-bezier(.4,0,.2,1)';

    var metric     = 'campaigns';
    var expanded   = false;
    var menuOpen   = false;
    var autoTimer  = null;
    var heightAnim = null;

    // Stage for the metric reveal: the two stacked summary layers live in a
    // clipped box, so the outgoing one is cropped as it slides up out of
    // frame while the incoming one scales in beneath it (see crossfadeSummary).
    summary.innerHTML =
      '<div class="cm-clip">' +
        '<div class="cm-layer is-active" data-metric="campaigns">' + campaignsSummaryHtml() + '</div>' +
        '<div class="cm-layer" data-metric="goals">' + goalsSummaryHtml() + '</div>' +
      '</div>';

    var clip   = summary.querySelector('.cm-clip');
    var layers = summary.querySelectorAll('.cm-layer');

    function renderRows() {
      rows.innerHTML = metric === 'campaigns'
        ? MOCK_CAMPAIGNS.map(campaignRowHtml).join('')
        : GOAL_ACCOUNTS.map(goalRowHtml).join('');
    }

    // Slide the detail open/closed. The committed final height is set inline
    // first (so the resting state is always correct); element.animate() then
    // plays the visible slide between the old and new heights.
    function animateHeight(toOpen) {
      var from = detail.getBoundingClientRect().height;
      detail.style.height = toOpen ? 'auto' : '0px';
      var to = toOpen ? detailPad.getBoundingClientRect().height : 0;
      detail.style.height = toOpen ? (to + 'px') : '0px';
      if (heightAnim) heightAnim.cancel();
      if (cmReduceMotion() || !detail.animate) return;
      heightAnim = detail.animate(
        [{ height: from + 'px' }, { height: to + 'px' }],
        { duration: 440, easing: EASE }
      );
    }

    // Re-measure while already open — the two metrics can have different row
    // counts, so the open height changes when switching.
    function resizeOpen() {
      if (!expanded) return;
      var from = detail.getBoundingClientRect().height;
      detail.style.height = 'auto';
      var to = detailPad.getBoundingClientRect().height;
      detail.style.height = to + 'px';
      if (heightAnim) heightAnim.cancel();
      if (cmReduceMotion() || !detail.animate) return;
      heightAnim = detail.animate(
        [{ height: from + 'px' }, { height: to + 'px' }],
        { duration: 320, easing: EASE }
      );
    }

    // ── Metric reveal transition ─────────────────────────────────────
    // Swap the summary between metrics with the "page preloading" reveal
    // (after Codrops' Page Preloading Effect, demo 2), on the demo's signature
    // cubic-bezier(.7,0,.3,1):
    //   (out) the outgoing title + progress bar lift up and away together,
    //   (in)  then the incoming title + progress bar enter in together.
    // The title lives in the head (the dropdown label), the bar in the summary
    // strip, but they animate in lockstep so the metric reads as one block.
    // The resting state (.is-active class + committed label text) is set up
    // front, so the card is correct even when the motion is skipped (reduced
    // motion / no Web Animations) or interrupted mid-flight.
    var REVEAL_EASE = 'cubic-bezier(.7,0,.3,1)';
    var OUT_MS      = 380;   // outgoing lift; the incoming enters once it clears
    var IN_MS       = 460;   // incoming reveal
    var revealAnims = [];

    function cancelReveal() {
      revealAnims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      revealAnims = [];
      summary.classList.remove('is-anim');   // restore CSS layer transitions
    }

    function crossfadeSummary(m) {
      var incoming = clip.querySelector('.cm-layer[data-metric="' + m + '"]');
      var outgoing = clip.querySelector('.cm-layer.is-active');

      // Commit the resting state first (so the card is right regardless of
      // motion), cancelling any reveal still in flight.
      cancelReveal();
      Array.prototype.forEach.call(layers, function (layer) {
        layer.classList.toggle('is-active', layer.getAttribute('data-metric') === m);
      });

      if (cmReduceMotion() || !incoming || !outgoing || incoming === outgoing || !incoming.animate) {
        label.textContent = META[m];   // CSS cross-fades the bar swap on its own
        return;
      }

      // Hand the layers to the Web Animations API for the reveal: kill their
      // CSS transitions first, since a running transition (re-triggered by the
      // .is-active toggle above) outranks a script animation in the cascade
      // and would otherwise pin the transform.
      summary.classList.add('is-anim');

      // (out) Outgoing title + bar lift up and away together. fill:'forwards'
      //       so they hold out-of-frame until the incoming takes over.
      var liftOut = { duration: OUT_MS, fill: 'forwards', easing: REVEAL_EASE };
      revealAnims.push(outgoing.animate(
        [{ opacity: 1, transform: 'translateY(0)' },
         { opacity: 0, transform: 'translateY(-100%)' }],
        liftOut
      ));
      var titleOut = label.animate(
        [{ opacity: 1, transform: 'translateY(0)' },
         { opacity: 0, transform: 'translateY(-100%)' }],
        liftOut
      );
      revealAnims.push(titleOut);

      // Swap the title text once it's lifted out of sight (the label is at
      // opacity 0 by then, so there's no flash of the old text).
      titleOut.finished.then(function () { label.textContent = META[m]; })
                       .catch(function () {});

      // (in) Incoming title + bar enter in together, once the outgoing has
      //      cleared (delay: OUT_MS). The bar scales in (the demo's content
      //      reveal); the title rises in alongside it. fill:'forwards' on the
      //      title so its backwards fill can't pin the still-running lift-out.
      var inAnim = incoming.animate(
        [{ opacity: 0, transform: 'scale(.34)' },
         { opacity: 1, transform: 'scale(1)' }],
        { delay: OUT_MS, duration: IN_MS, fill: 'both', easing: REVEAL_EASE }
      );
      revealAnims.push(inAnim);
      revealAnims.push(label.animate(
        [{ opacity: 0, transform: 'translateY(60%)' },
         { opacity: 1, transform: 'translateY(0)' }],
        { delay: OUT_MS, duration: IN_MS, fill: 'forwards', easing: REVEAL_EASE }
      ));

      // Once settled, drop the WAAPI fills back to the CSS resting state
      // (which already matches, so there's no visible jump).
      inAnim.finished.then(cancelReveal).catch(function () {});
    }

    function setMetric(m, opts) {
      opts = opts || {};
      if (m === metric && !opts.force) return;
      metric = m;
      crossfadeSummary(m);   // owns the label text swap (synced to the lift)
      Array.prototype.forEach.call(menu.children, function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-metric') === m);
      });
      // Re-render synchronously so the rows always match the label/summary
      // (never gate the DOM swap on an animation callback). The fade-in is
      // purely cosmetic.
      renderRows();
      if (!cmReduceMotion() && rows.animate) {
        // Rise + fade in step with the incoming reveal (after the lift-out).
        rows.animate(
          [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: OUT_MS, easing: REVEAL_EASE, fill: 'backwards' }
        );
      }
      resizeOpen();
      if (!opts.fromAuto) restartAuto();
    }

    function setExpanded(on) {
      expanded = on;
      card.classList.toggle('is-expanded', on);
      expand.setAttribute('aria-expanded', on ? 'true' : 'false');
      expand.setAttribute('aria-label', on ? 'Collapse breakdown' : 'Expand breakdown');
      animateHeight(on);
    }

    function openMenu(on) {
      menuOpen = on;
      metricEl.setAttribute('data-open', on ? '1' : '0');
      menu.hidden = !on;
      trigger.setAttribute('aria-expanded', on ? 'true' : 'false');
      card.setAttribute('data-paused', on ? '1' : '0');   // pause auto-cycle
    }

    function startAuto() {
      autoTimer = window.setInterval(function () {
        if (menuOpen) return;   // don't swap out from under an open dropdown
        setMetric(metric === 'campaigns' ? 'goals' : 'campaigns', { fromAuto: true });
      }, 5500);
    }
    // Restart the 5.5s auto-cycle clock after a manual switch.
    function restartAuto() {
      window.clearInterval(autoTimer);
      startAuto();
    }

    trigger.addEventListener('click', function (e) { e.stopPropagation(); openMenu(!menuOpen); });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-metric]');
      if (!b) return;
      setMetric(b.getAttribute('data-metric'));
      openMenu(false);
    });
    document.addEventListener('click', function () { if (menuOpen) openMenu(false); });
    expand.addEventListener('click', function () { setExpanded(!expanded); });

    renderRows();
    startAuto();
  }

  function renderActiveCampaigns() {
    // OTA bundles ship CSS+JS only — index.html is whatever shipped in the
    // installed APK, so the card may be missing entirely or carry the older
    // (pre-redesign) markup. Get-or-create it, normalize the element's own
    // classes/attributes, then mount the component (which rewrites the body)
    // so the redesign lands via OTA regardless of the bundled markup.
    var card = document.getElementById('activeCampaignsCard');
    if (!card) {
      var dash = document.getElementById('dashboard');
      if (!dash) return;
      card = document.createElement('section');
      card.id = 'activeCampaignsCard';
      card.setAttribute('data-route-target', 'campaigns');
      dash.insertBefore(card, dash.firstChild);
    }
    card.className = 'card card-wide campaigns-block campaign-manager';
    card.setAttribute('data-paused', '0');

    if (!card.__cmBuilt) {
      mountCampaignManager(card);
      card.__cmBuilt = true;
    }
  }

  function syncRouteFromScroll() {
    if (routeLock) {
      setRoute(routeLock);
      return;
    }
    if (!document.body) return;

    var route = 'home';
    var checkpoint = window.scrollY + currentStickyOffset() + 24;
    var camp = activeCampaignsSection();
    if (camp && checkpoint >= camp.offsetTop) route = 'campaigns';

    setRoute(route);
  }

  function bindBottomNav() {
    if (!els.bottomnav) return;

    els.bottomnav.addEventListener('click', function (ev) {
      var item = ev.target.closest && ev.target.closest('.item');
      if (!item) return;

      var route = item.getAttribute('data-route');

      if (route === 'home') {
        closeAcctPanel();
        closeAdminMenu();
        closeAppMenu();
        routeLock = null;
        setRoute('home');
        scrollToY(0);
        return;
      }
      if (route === 'campaigns') {
        closeAcctPanel();
        closeAdminMenu();
        closeAppMenu();
        scrollToSection(activeCampaignsSection(), 'campaigns');
        return;
      }
      if (route === 'profile') {
        lockRoute('profile');
        // The "profile" tab now opens the account selector (no separate auth UI).
        toggleAcctPanel();
      }
    });

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (routeLock || ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        syncRouteFromScroll();
      });
    }, { passive: true });
    window.addEventListener('resize', syncRouteFromScroll);
    syncRouteFromScroll();
  }

  // -------- Settings modal ----------------------------------------

  function openSettings() {
    var s = loadSettings();
    $('setUrl').value           = s.url;
    $('setToken').value         = s.token;
    $('setQuery').value         = s.query;
    $('setGelfUrl').value       = s.gelfUrl;
    $('setAutoRefresh').checked = s.autoRefresh;
    els.settingsModal.classList.remove('hidden');
  }
  function closeSettings() { els.settingsModal.classList.add('hidden'); }

  function persistFromForm() {
    var s = {
      url:         $('setUrl').value.trim().replace(/\/+$/, ''),
      token:       $('setToken').value.trim(),
      query:       $('setQuery').value.trim() || 'source:tiktok-bookmarklet',
      gelfUrl:     $('setGelfUrl').value.trim() || DEFAULT_GELF_URL,
      autoRefresh: $('setAutoRefresh').checked
    };
    saveSettings(s);
    return s;
  }

  // Pull the unique creator list from Graylog and rebuild the roster.
  // Best-effort: failures are logged but do not block the UI.
  function refreshRoster() {
    var s = loadSettings();
    if (!s.url || !s.token) return Promise.resolve([]);
    var client = new GraylogClient({ baseUrl: s.url, token: s.token });
    return Users.refresh(client, s.query)
      .catch(function (err) {
        console.warn('Users.refresh failed:', err && err.message || err);
        return [];
      });
  }

  // -------- Account selector --------------------------------------

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  // Deterministic per-creator color (shoulder-stable hue from the id) so the
  // little dots in the picker stay consistent across sessions and reorder.
  function colorFor(id) {
    var s = String(id || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return 'hsl(' + (h % 360) + ' 70% 55%)';
  }
  var ALL_COLOR = 'hsl(28 95% 56%)';   // primary accent

  // Deterministic per-id mock streak (1–14 days). The dashboard has no
  // real "consecutive posting days" data source yet — Graylog stores per-
  // event timestamps but the bookmarklet roll-up isn't there. Until that
  // ships we hash the id so streaks stay stable across reloads and look
  // intentional rather than random. Replace with a real query when ready.
  function streakFor(id) {
    var s = String(id || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h % 14) + 1;
  }

  function renderAcctTrigger() {
    var scope = Users.getScope();
    var members = Users.members();

    if (scope === '__all') {
      els.acctTriggerDot.style.background = ALL_COLOR;
      els.acctTriggerLabel.textContent = 'All Accounts';
      els.acctTriggerLabel.title = members.length + ' creators';
      return;
    }

    if (scope.length === 1) {
      els.acctTriggerDot.style.background = colorFor(scope[0].id);
      els.acctTriggerLabel.textContent = scope[0].name;
      els.acctTriggerLabel.title = scope[0].creator || '';
      return;
    }

    els.acctTriggerDot.style.background = ALL_COLOR;
    els.acctTriggerLabel.textContent = scope.length + ' accounts';
    els.acctTriggerLabel.title = scope.map(function (u) { return u.name; }).join(', ');
  }

  function acctRow(opts) {
    // opts: { id, label, dotColor, active, streak, onClick }
    //   label    — primary text shown after the dot (e.g. "@boosteddealsdaily"
    //              for a creator, "All Accounts" for the aggregate row)
    //   streak   — optional number of consecutive posting days; rendered as
    //              a 🔥Nd chip on the right when present and > 0
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'acct-row' + (opts.active ? ' acct-row-active' : '');
    b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', opts.active ? 'true' : 'false');

    var streakHtml = '';
    if (opts.streak && opts.streak > 0) {
      streakHtml =
        '<span class="acct-row-streak" title="' + opts.streak + '-day streak">' +
          '<span class="acct-row-streak-emoji" aria-hidden="true">🔥</span>' +
          '<span class="acct-row-streak-val">' + opts.streak + 'd</span>' +
        '</span>';
    } else if (opts.meta) {
      streakHtml = '<span class="acct-row-meta">' + escapeHtml(opts.meta) + '</span>';
    }

    b.innerHTML =
      '<span class="acct-dot" style="background:' + escapeHtml(opts.dotColor) + '"></span>' +
      '<span class="acct-row-label">' + escapeHtml(opts.label) + '</span>' +
      streakHtml +
      '<span class="acct-check" aria-hidden="true">' + (opts.active ? '✓' : '') + '</span>';
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      opts.onClick();
    });
    return b;
  }

  function renderAcctPanel() {
    var scope = Users.getScope();
    var members = Users.members();
    var selectedIds = Object.create(null);
    if (scope !== '__all') scope.forEach(function (u) { selectedIds[u.id] = true; });

    var panel = els.acctPanel;
    panel.innerHTML = '';

    var aggHeader = document.createElement('h4');
    aggHeader.textContent = 'Aggregate';
    panel.appendChild(aggHeader);
    panel.appendChild(acctRow({
      id: '__all',
      label: 'All Accounts',
      meta: members.length + ' creators',
      dotColor: ALL_COLOR,
      active: scope === '__all',
      onClick: function () {
        Users.clearScope();
        renderAcctTrigger();
        renderAcctPanel();
        refresh();
      }
    }));

    if (members.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'acct-empty';
      empty.textContent = 'No creators yet — open Settings to point at Graylog.';
      panel.appendChild(empty);
      return;
    }

    var listHeader = document.createElement('h4');
    listHeader.textContent = 'Accounts';
    panel.appendChild(listHeader);

    members.forEach(function (m) {
      panel.appendChild(acctRow({
        id: m.id,
        // Primary label is now the @handle. Falls back to id when a
        // member entry somehow has no .creator (shouldn't happen in
        // production but Users.refresh has been seen to seed odd data).
        label: m.creator || ('@' + m.id),
        dotColor: colorFor(m.id),
        active: !!selectedIds[m.id],
        streak: streakFor(m.id),
        onClick: function () {
          Users.toggle(m.id);
          renderAcctTrigger();
          renderAcctPanel();
          refresh();
        }
      }));
    });
  }

  function openAcctPanel() {
    lockRoute('profile');
    renderAcctPanel();
    els.acctPanel.classList.remove('hidden');
    els.acctSelect.classList.add('open');
    els.acctTrigger.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', acctOutsideCloser, { once: true });
    }, 0);
  }
  function closeAcctPanel() {
    if (!els.acctPanel || els.acctPanel.classList.contains('hidden')) return;
    els.acctPanel.classList.add('hidden');
    els.acctSelect.classList.remove('open');
    els.acctTrigger.setAttribute('aria-expanded', 'false');
    if (routeLock === 'profile') unlockRoute();
  }
  function toggleAcctPanel() {
    if (els.acctPanel.classList.contains('hidden')) openAcctPanel();
    else                                            closeAcctPanel();
  }
  function acctOutsideCloser(ev) {
    if (ev.target.closest && ev.target.closest('#acctSelect')) {
      // Re-arm so the next outside click closes it.
      document.addEventListener('click', acctOutsideCloser, { once: true });
      return;
    }
    closeAcctPanel();
  }

  // -------- Admin menu (admin-only) -------------------------------

  function menuItem(label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'user-dd-item';
    b.setAttribute('role', 'menuitem');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }
  function divider() {
    var d = document.createElement('div');
    d.className = 'user-dd-divider';
    return d;
  }

  function renderAdminMenu() {
    if (!Users.isAdmin()) {
      els.adminMenu.classList.add('hidden');
      return;
    }
    els.adminMenu.classList.remove('hidden');

    var dd = els.adminMenuDropdown;
    dd.innerHTML = '';

    var header = document.createElement('div');
    header.className = 'user-dd-header';
    header.innerHTML =
      '<div class="user-dd-name">Daniel</div>' +
      '<div class="user-dd-meta">admin</div>';
    dd.appendChild(header);
    dd.appendChild(divider());

    var common = loadCommonDashConfig();
    if (common) {
      dd.appendChild(menuItem(common.name, function () {
        closeAdminMenu();
        openCommonDashboard();
      }));
      dd.appendChild(divider());
    }

    dd.appendChild(menuItem('Sign out (admin)', function () {
      // Drop the admin flag; scope state is left as-is.
      try {
        var raw = localStorage.getItem('tok-scrape.auth.v1');
        var p = raw ? JSON.parse(raw) : {};
        if (p && p.userId) { delete p.userId; localStorage.setItem('tok-scrape.auth.v1', JSON.stringify(p)); }
      } catch (e) {}
      closeAdminMenu();
      renderAdminMenu();
    }));
  }
  function openAdminMenu() {
    renderAdminMenu();
    els.adminMenuDropdown.classList.remove('hidden');
    els.adminMenuBtn.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', adminOutsideCloser, { once: true });
    }, 0);
  }
  function closeAdminMenu() {
    if (!els.adminMenuDropdown || els.adminMenuDropdown.classList.contains('hidden')) return;
    els.adminMenuDropdown.classList.add('hidden');
    els.adminMenuBtn.setAttribute('aria-expanded', 'false');
  }
  function adminOutsideCloser(ev) {
    if (ev.target.closest && ev.target.closest('#adminMenu')) {
      document.addEventListener('click', adminOutsideCloser, { once: true });
      return;
    }
    closeAdminMenu();
  }

  // -------- App menu (visible to every user) ----------------------

  function openAppMenu() {
    els.appMenuDropdown.classList.remove('hidden');
    els.appMenuBtn.setAttribute('aria-expanded', 'true');
    setTimeout(function () {
      document.addEventListener('click', appOutsideCloser, { once: true });
    }, 0);
  }
  function closeAppMenu() {
    if (!els.appMenuDropdown || els.appMenuDropdown.classList.contains('hidden')) return;
    els.appMenuDropdown.classList.add('hidden');
    els.appMenuBtn.setAttribute('aria-expanded', 'false');
  }
  function appOutsideCloser(ev) {
    if (ev.target.closest && ev.target.closest('#appMenu')) {
      document.addEventListener('click', appOutsideCloser, { once: true });
      return;
    }
    closeAppMenu();
  }

  // -------- Add Exported Data (xlsx -> Graylog) -------------------

  function setUploadStatus(msg, kind) {
    if (!els.uploadStatus) return;
    if (!msg) { els.uploadStatus.classList.add('hidden'); els.uploadStatus.textContent = ''; return; }
    els.uploadStatus.textContent = msg;
    els.uploadStatus.classList.remove('hidden', 'is-error', 'is-success');
    if (kind === 'error')   els.uploadStatus.classList.add('is-error');
    if (kind === 'success') els.uploadStatus.classList.add('is-success');
  }

  // "23/04/2026 17:28:53" (DD/MM/YYYY) -> "2026-04-23T17:28:53" (local).
  // Returns '' if the input doesn't match — callers fall back to scrapedAt.
  function affiliateDateToIso(s) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(String(s || '').trim());
    if (!m) return '';
    return m[3] + '-' + m[2] + '-' + m[1] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
  }

  // "23.45" -> 23.45    "$1,234.56" -> 1234.56    "" -> NaN
  function parseNumeric(s) {
    if (s == null || s === '') return NaN;
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? NaN : n;
  }

  // Build a GELF v1.1 message for a single affiliate-export row. We send the
  // raw textual values as-is alongside a few `*_num` siblings parsed to
  // numbers — this keeps the source of truth intact while letting Graylog
  // aggregate over numeric fields. timestamp comes from Order date when
  // parseable; otherwise falls back to the upload time.
  function gelfFromOrder(row, agencyOverride, scrapedAt) {
    var orderDate    = row['Order date'] || '';
    var orderDateIso = affiliateDateToIso(orderDate);
    var unixTs = orderDateIso
      ? Math.floor(new Date(orderDateIso).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    var contentType = row['Content Type'] || '';
    var gmv         = parseNumeric(row['GMV']);
    var orderId     = row['Order ID'] || '';

    var gelf = {
      version: '1.1',
      host: 'tiktok-affiliate-export',
      short_message: 'affiliate order ' + orderId + ': ' + (row['Currency'] || '') + ' ' + (row['GMV'] || '0') + ' ' + contentType,
      timestamp: unixTs,
      // creator is what the dashboard's account picker filters on. The export
      // doesn't carry the actual TikTok handle, only the agency label, so we
      // mirror it into both fields.
      _creator:                    agencyOverride || row['Agency'] || '',
      _agency:                     row['Agency'] || '',
      _scraped_at:                 scrapedAt,
      _order_id:                   orderId,
      _sku_id:                     row['SKU ID'] || '',
      _product_id:                 row['Product ID'] || '',
      _product_name:               row['Product name'] || '',
      _shop_name:                  row['Shop name'] || '',
      _shop_code:                  row['Shop code'] || '',
      _affiliate_partner:          row['Affiliate partner'] || '',
      _currency:                   row['Currency'] || '',
      _order_type:                 row['Order type'] || '',
      _order_settlement_status:    row['Order settlement status'] || '',
      _commission_type:            row['Commission type'] || '',
      _content_type:               contentType,
      _content_id:                 row['Content ID'] || '',
      _standard_rate:              row['Standard'] || '',
      _order_date:                 orderDate,
      _order_date_iso:             orderDateIso,
      _commission_settlement_date: row['Commission settlement date'] || '',
      // Numeric siblings for aggregation. Skip when not parseable so the GELF
      // input doesn't reject the whole message on a bad cell.
      _price_num:                  parseNumeric(row['Price']),
      _gmv_num:                    gmv,
      _items_sold_num:             parseNumeric(row['Items sold']),
      _items_refunded_num:         parseNumeric(row['Items refunded']),
      _est_commission_num:         parseNumeric(row['Est. standard commission']),
      _actual_commission_num:      parseNumeric(row['Standard commission']),
      _total_final_earned_num:     parseNumeric(row['Total final earned amount'])
    };
    // Strip NaN — GELF rejects messages whose numeric fields don't parse.
    Object.keys(gelf).forEach(function (k) {
      if (typeof gelf[k] === 'number' && isNaN(gelf[k])) delete gelf[k];
    });
    return gelf;
  }

  function pickExportedFile() {
    closeAppMenu();
    var s = loadSettings();
    if (!s.gelfUrl) {
      setUploadStatus('Set the Graylog GELF endpoint in Settings first.', 'error');
      return;
    }
    els.exportedFile.value = '';     // allow re-picking the same file
    els.exportedFile.click();
  }

  function onExportedFileChosen(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    handleExportedFile(file).catch(function (err) {
      console.error(err);
      setUploadStatus('Upload failed: ' + (err && err.message || err), 'error');
    });
  }

  // Read the file -> parse xlsx -> push one GELF message per row -> refresh
  // the dashboard so the new section picks up the data. We push sequentially
  // (with a tiny chunk of parallelism) so a flaky network doesn't fan out
  // hundreds of in-flight requests; the typical export is ~60 rows.
  function handleExportedFile(file) {
    var s = loadSettings();
    if (!s.gelfUrl) return Promise.reject(new Error('GELF endpoint not configured'));

    setUploadStatus('Reading ' + file.name + '…');
    return file.arrayBuffer()
      .then(function (ab) {
        return XlsxReader.parse(ab);
      })
      .then(function (parsed) {
        var rows = parsed.rows || [];
        if (!rows.length) throw new Error('Spreadsheet has no data rows.');

        // Best-effort agency override: when the user is scoped to a single
        // creator we attribute the upload to them so the dashboard picker
        // can filter to it; otherwise we let each row's Agency cell win.
        var scope = Users.getScope();
        var agencyOverride = (scope !== '__all' && scope.length === 1) ? scope[0].creator || '' : '';
        var scrapedAt = new Date().toISOString();

        setUploadStatus('Sending 0 / ' + rows.length + ' orders to Graylog…');
        return pushOrdersBatched(rows, s.gelfUrl, agencyOverride, scrapedAt);
      })
      .then(function (summary) {
        var failures = summary.failed;
        if (failures > 0) {
          setUploadStatus('Sent ' + summary.sent + ' / ' + summary.total + ' (' + failures + ' failed). Refreshing…',
            failures === summary.total ? 'error' : null);
        } else {
          setUploadStatus('Sent ' + summary.sent + ' orders. Refreshing…', 'success');
        }
        // Give Graylog a beat to index before refreshing.
        return new Promise(function (resolve) { setTimeout(resolve, 1500); })
          .then(refresh)
          .then(function () {
            // Auto-hide the success pill after a short delay.
            if (failures === 0) setTimeout(function () { setUploadStatus(''); }, 4000);
          });
      });
  }

  function pushOrdersBatched(rows, gelfUrl, agencyOverride, scrapedAt) {
    var concurrency = 4;
    var i = 0, sent = 0, failed = 0, inflight = 0;
    var total = rows.length;
    return new Promise(function (resolve) {
      function next() {
        if (i >= total && inflight === 0) {
          resolve({ sent: sent, failed: failed, total: total });
          return;
        }
        while (inflight < concurrency && i < total) {
          var idx = i++;
          inflight++;
          postGelf(gelfUrl, gelfFromOrder(rows[idx], agencyOverride, scrapedAt))
            .then(function () { sent++; })
            .catch(function (err) {
              failed++;
              console.warn('[upload] order', idx, 'failed:', err && err.message || err);
            })
            .then(function () {
              inflight--;
              setUploadStatus('Sending ' + (sent + failed) + ' / ' + total + ' orders to Graylog…');
              next();
            });
        }
      }
      next();
    });
  }

  // -------- Common dashboard view ---------------------------------

  function setCommonDashStatus(msg, isError) {
    if (!els.commonDashStatus) return;
    if (!msg) { els.commonDashStatus.classList.add('hidden'); return; }
    els.commonDashStatus.textContent = msg;
    els.commonDashStatus.classList.toggle('error', !!isError);
    els.commonDashStatus.classList.remove('hidden');
  }

  function ensureGraylogSession(s) {
    if (commonDashSessionPromise) return commonDashSessionPromise;
    var client = new GraylogClient({ baseUrl: s.url, token: s.token });
    commonDashSessionPromise = client.establishSession()
      .catch(function (err) {
        commonDashSessionPromise = null;
        throw err;
      });
    return commonDashSessionPromise;
  }

  function openCommonDashboard() {
    var common = loadCommonDashConfig();
    if (!common) return;
    var s = loadSettings();
    if (!s.url || !s.token) {
      showError('Settings missing — cannot load Seller Comparison.');
      return;
    }
    lockRoute('profile');
    els.commonDashView.classList.remove('hidden');
    els.commonDashView.setAttribute('aria-hidden', 'false');
    setCommonDashStatus('Signing in to Graylog…', false);
    els.commonDashFrame.src = 'about:blank';

    ensureGraylogSession(s)
      .then(function () {
        setCommonDashStatus('Loading dashboard…', false);
        var url = s.url.replace(/\/+$/, '') + '/dashboards/' + encodeURIComponent(common.graylogDashboardId);
        els.commonDashFrame.onload = function () { setCommonDashStatus('', false); };
        els.commonDashFrame.src = url;
      })
      .catch(function (err) {
        setCommonDashStatus('Could not sign in to Graylog: ' + (err && err.message || err), true);
      });
  }

  function closeCommonDashboard() {
    els.commonDashView.classList.add('hidden');
    els.commonDashView.setAttribute('aria-hidden', 'true');
    els.commonDashFrame.src = 'about:blank';
    setCommonDashStatus('', false);
    if (routeLock === 'profile') unlockRoute();
  }

  // -------- Refresh loop ------------------------------------------

  // Time-range ladder for auto-widening. The selected window can be empty —
  // the most-recent scrapes may be older than "Last hour"/"Today", and a window
  // newer than every message even makes Graylog 500 (handled in api.js). Rather
  // than show a blank dashboard (or an error), we widen the search step by step
  // until something turns up, then tell the user we did. 0 = all-time (widest).
  var RANGE_ORDER = [3600, 86400, 604800, 2592000, 7776000]; // ascending
  var RANGE_LABEL = {
    3600:    'the last hour',
    86400:   'today',
    604800:  'the last 7 days',
    2592000: 'the last 30 days',
    7776000: 'the last 90 days',
    0:       'all available data'
  };
  function rangeLabel(sec) { return RANGE_LABEL[sec] || 'the selected range'; }

  // Ranges to try, from the selected one outward, ending with all-time.
  function widenLadder(sec) {
    if (sec === 0) return [0];
    var i = RANGE_ORDER.indexOf(sec);
    if (i === -1) return [sec, 0];
    return RANGE_ORDER.slice(i).concat([0]);
  }

  function fetchAllAt(client, s, rangeSec, creatorFilter) {
    return Promise.all([
      client.fetchScrapes(s.query, rangeSec, creatorFilter),
      client.fetchLiveAnalytics(rangeSec, creatorFilter),
      client.fetchAffiliateOrders(rangeSec, creatorFilter).catch(function (err) {
        // Non-fatal — affiliate-export is an opt-in dataset (xlsx upload),
        // so its absence shouldn't block the rest of the dashboard.
        console.warn('fetchAffiliateOrders failed:', err && err.message || err);
        return [];
      }),
      client.fetchDataOverview(rangeSec, creatorFilter).catch(function (err) {
        // Likewise non-fatal — data-overview is one of several optional
        // sources, and an older Graylog mapping might surface a 400 here.
        console.warn('fetchDataOverview failed:', err && err.message || err);
        return [];
      }),
      client.fetchCreatorAnalytics(rangeSec).catch(function (err) {
        // Agency-wide source; not all accounts will have it ingested yet.
        console.warn('fetchCreatorAnalytics failed:', err && err.message || err);
        return [];
      }),
      client.fetchProductAnalytics(rangeSec, creatorFilter).catch(function (err) {
        // Optional seller source; absent until the product-analysis scraper runs.
        console.warn('fetchProductAnalytics failed:', err && err.message || err);
        return [];
      })
    ]);
  }

  function anyResults(results) {
    return results.some(function (r) { return r && r.length > 0; });
  }

  // Walk the ladder from the selected range outward; resolve at the first range
  // that yields data (or the widest, all-time, if nothing does). Real fetch
  // errors (401/network) still reject — only empty windows advance the ladder.
  function searchWidening(client, s, ladder, idx, creatorFilter) {
    var rangeSec = ladder[idx];
    return fetchAllAt(client, s, rangeSec, creatorFilter).then(function (results) {
      if (anyResults(results) || idx >= ladder.length - 1) {
        return { rangeSec: rangeSec, results: results, widened: idx > 0, hasData: anyResults(results) };
      }
      return searchWidening(client, s, ladder, idx + 1, creatorFilter);
    });
  }

  // No Graylog results in any window. Keep the Campaign Manager card on screen
  // (setNoData hides only the data cards) and explain in a slim notice rather
  // than the full-screen "open settings" empty state.
  function renderNoData(msg) {
    setNoData(true);
    if (els.empty) els.empty.classList.add('hidden');
    showNotice(msg);
    syncRouteFromScroll();
  }

  function refresh() {
    if (loading) return;

    var s = loadSettings();
    renderActiveCampaigns(); // the campaign card is always present, even pre-fetch

    if (!s.url || !s.token) {
      showError('');
      hideNotice();
      showEmpty(true, 'Set your Graylog URL and API token in Settings, then refresh.');
      return;
    }
    showError('');
    loading = true;

    var selectedSec   = parseInt(els.range.value, 10) || 0;
    var creatorFilter = Users.getCreatorFilters();   // null for "All Accounts"
    var client        = new GraylogClient({ baseUrl: s.url, token: s.token });
    var ladder        = widenLadder(selectedSec);

    searchWidening(client, s, ladder, 0, creatorFilter)
      .then(function (outcome) {
        renderOutcome(outcome, creatorFilter, selectedSec);
      })
      .catch(function (err) {
        console.error(err);
        var msg = (err && err.message) || String(err);
        if (/Failed to fetch|NetworkError|TypeError/i.test(msg)) {
          msg = 'Could not reach Graylog. Check the URL and that CORS is enabled (http_enable_cors=true).';
        } else if (err && err.status === 401) {
          msg = 'Graylog rejected the API token (401).';
        }
        showError(msg);
      })
      .then(function () {
        loading = false;
      });
  }

  // Render the dashboard for the range the widening loop settled on. `rangeSec`
  // is the EFFECTIVE range (possibly wider than the user's selection);
  // `selectedSec` is what they actually picked — used only for the notice copy.
  function renderOutcome(outcome, creatorFilter, selectedSec) {
    var rangeSec        = outcome.rangeSec;
    var results         = outcome.results;
    var videoScrapes    = results[0];
    var liveScrapes     = results[1];
    var affiliateRows   = results[2] || [];
    var overviewScrapes = results[3] || [];
    var caScrapes       = results[4] || [];
    var productScrapes  = results[5] || [];
    var hasVideos    = videoScrapes.length > 0;
    var hasLive      = liveScrapes.length > 0;
    var hasAffiliate = affiliateRows.length > 0;
    var hasOverview  = overviewScrapes.length > 0;
    var hasCa        = caScrapes.length > 0;
    var hasProduct   = productScrapes.length > 0;

    // Tell the user when we showed a wider window than they selected.
    function noticeForWiden() {
      if (outcome.widened) {
        showNotice('No data in ' + rangeLabel(selectedSec) + ' — showing ' + rangeLabel(rangeSec) + '.');
      } else {
        hideNotice();
      }
    }

    // Map rangeSec → required inclusive day-span for the Data Overview card.
    // Today = 1-day snapshots, Last 7d = 7-day snapshots; other ranges keep the
    // existing "most recent regardless of span" behavior.
    var spanForOverview = null;
    if (rangeSec === 86400)  spanForOverview = 0;
    if (rangeSec === 604800) spanForOverview = 6;

    // Overview card hides itself when no metrics; renderOverview also toggles
    // .hidden, so we just call it unconditionally.
    Dashboard.renderOverview(overviewScrapes, { spanDays: spanForOverview });
    Dashboard.renderCreatorAnalytics(caScrapes);
    Dashboard.renderProductAnalytics(productScrapes);

    if (rangeSec === 86400) {
      setTodayOnlyMode(true);
      // The Creator/Product Analytics cards aren't span-filtered (they show the
      // latest scrape regardless of range) and survive Today mode, so only fall
      // back to the no-data notice when NONE of these cards rendered.
      var todaySurvivors = ['overviewCard', 'creatorAnalysisCard', 'productAnalysisCard'];
      var anyCardShown = todaySurvivors.some(function (id) {
        var el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
      });
      if (anyCardShown) {
        setNoData(false);
        els.empty.classList.add('hidden');
        noticeForWiden();
      } else {
        var todayMsg = creatorFilter
          ? 'No "Today" snapshots found for ' + creatorFilter.join(', ') + '. Run the bookmarklet on the Data Overview page with the Today filter selected.'
          : 'No "Today" snapshots found. Run the bookmarklet on the Data Overview page with the Today filter selected.';
        renderNoData(todayMsg);
      }
      return;
    }
    setTodayOnlyMode(false);

    setToggleVisibility(hasVideos && hasLive);
    setAffiliateBlockVisibility(hasAffiliate);

    var mode = getMode();
    if (mode === 'videos' && !hasVideos && hasLive)  { setMode('live');   mode = 'live'; }
    else if (mode === 'live' && !hasLive && hasVideos) { setMode('videos'); mode = 'videos'; }

    if (!hasVideos && !hasLive && !hasAffiliate && !hasOverview && !hasCa && !hasProduct) {
      var msg = creatorFilter
        ? 'No scrapes found for ' + creatorFilter.join(', ') + ' — searched back to all available data.'
        : 'No scrapes found — searched back to all available data.';
      renderNoData(msg);
      return;
    }
    setNoData(false);
    els.empty.classList.add('hidden');
    if (mode === 'live') Dashboard.renderLive(liveScrapes);
    else if (hasVideos)  Dashboard.renderVideos(videoScrapes);
    if (hasAffiliate)    Dashboard.renderAffiliate(affiliateRows);
    noticeForWiden();
  }

  function setupAutoRefresh() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var s = loadSettings();
    if (s.autoRefresh) autoTimer = setInterval(refresh, 60 * 1000);
  }

  // -------- Bind / init -------------------------------------------

  function bind() {
    els.range.addEventListener('change', refresh);
    $('emptySettingsBtn').addEventListener('click', openSettings);
    $('setCancel').addEventListener('click', closeSettings);
    $('setSave').addEventListener('click', function () {
      persistFromForm();
      closeSettings();
      setupAutoRefresh();
      refreshRoster().then(function () {
        renderAcctTrigger();
        if (!els.acctPanel.classList.contains('hidden')) renderAcctPanel();
        refresh();
      });
    });

    // App menu (visible to all users)
    els.appMenuBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (els.appMenuDropdown.classList.contains('hidden')) openAppMenu();
      else                                                  closeAppMenu();
    });
    $('menuAddExported').addEventListener('click', pickExportedFile);
    $('menuServerSettings').addEventListener('click', function () {
      closeAppMenu();
      openSettings();
    });
    $('menuVirals').addEventListener('click', function () {
      closeAppMenu();
      if (window.Virals && typeof window.Virals.open === 'function') window.Virals.open();
    });
    els.exportedFile.addEventListener('change', onExportedFileChosen);

    // Account selector
    els.acctTrigger.addEventListener('click', function (ev) {
      ev.stopPropagation();
      toggleAcctPanel();
    });

    // Admin menu (only meaningful when Users.isAdmin())
    els.adminMenuBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (els.adminMenuDropdown.classList.contains('hidden')) openAdminMenu();
      else                                                    closeAdminMenu();
    });

    // Common dashboard view (Seller Comparison)
    if (els.commonDashClose) {
      els.commonDashClose.addEventListener('click', closeCommonDashboard);
    }

    // Mode toggle (Videos / Live)
    var toggle = document.getElementById('modeToggle');
    if (toggle) {
      toggle.addEventListener('click', function (ev) {
        var btn = ev.target.closest && ev.target.closest('.mode-btn');
        if (!btn) return;
        var mode = btn.getAttribute('data-mode');
        if (mode === getMode()) return;
        setMode(mode);
        refresh();
      });
    }

    document.addEventListener('deviceready', function () {
      if (window.StatusBar) StatusBar.styleLightContent();
    }, false);

    bindBottomNav();
  }

  // Lift the per-mode headline KPI cards (Videos / Live / Affiliate) so they
  // render directly above the Data Overview card. The card order is baked into
  // the APK's index.html, which OTA bundles can't replace (ota.js only swaps
  // JS/CSS, never the document), so we reposition the existing nodes at
  // runtime — same reason the Active Campaigns card is built in JS.
  function liftKpiCardsAboveOverview() {
    var dash = document.getElementById('dashboard');
    var overview = document.getElementById('overviewCard');
    if (!dash || !overview || overview.parentNode !== dash) return;
    var kpiCards = dash.querySelectorAll('section.card.kpi[data-mode]');
    Array.prototype.forEach.call(kpiCards, function (card) {
      if (card.parentNode === dash) dash.insertBefore(card, overview);
    });
  }

  function init() {
    els.dashboard        = $('dashboard');
    els.empty            = $('emptyState');
    els.err              = $('errorBanner');
    els.settingsModal    = $('settingsModal');
    els.range            = $('rangeSel');
    els.acctSelect       = $('acctSelect');
    els.acctTrigger      = $('acctTrigger');
    els.acctTriggerDot   = $('acctTriggerDot');
    els.acctTriggerLabel = $('acctTriggerLabel');
    els.acctPanel        = $('acctPanel');
    els.appMenu          = $('appMenu');
    els.appMenuBtn       = $('appMenuBtn');
    els.appMenuDropdown  = $('appMenuDropdown');
    els.exportedFile     = $('exportedFile');
    els.uploadStatus     = $('uploadStatus');
    els.adminMenu        = $('adminMenu');
    els.adminMenuBtn     = $('adminMenuBtn');
    els.adminMenuDropdown = $('adminMenuDropdown');
    els.topbar           = document.querySelector('.topbar');
    els.bottomnav        = document.querySelector('.bottomnav');
    els.commonDashView   = $('commonDashboardView');
    els.commonDashFrame  = $('commonDashFrame');
    els.commonDashClose  = $('commonDashClose');
    els.commonDashStatus = $('commonDashStatus');

    if (window.Highcharts && window.Dashboard) Dashboard.applyTheme();
    setMode(getMode());
    bind();
    renderAcctTrigger();
    renderAdminMenu();
    renderActiveCampaigns();
    liftKpiCardsAboveOverview();
    setupAutoRefresh();

    // No sign-in modal: open straight to the dashboard with the persisted /
    // preloaded scope. After the first Graylog refresh we re-render the picker
    // (the dynamic creator list may have grown).
    refresh();
    refreshRoster().then(function () {
      renderAcctTrigger();
      if (!els.acctPanel.classList.contains('hidden')) renderAcctPanel();
    });

    // Signal ota.js that init completed. ota.js was watching for this to
    // clear its "previous boot hung" flag and to skip the bad-bundle
    // recovery path. The OTA check itself is deferred a few seconds so
    // it doesn't compete with the dashboard's first paint.
    window.__OTA_INIT_DONE__ = true;
    if (window.OTA && typeof OTA.checkForUpdate === 'function') {
      setTimeout(function () { OTA.checkForUpdate(); }, 5000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
