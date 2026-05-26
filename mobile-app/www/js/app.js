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
  var DEFAULT_GELF_URL = 'https://tok-graylog-gelf.ngrok-free.dev/gelf';

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      var query = s.query || 'source:tiktok-bookmarklet';
      // Migrate the old broken default: Graylog indexes GELF `host` as `source`,
      // so `host:tiktok-bookmarklet` never matched any message. Rewrite silently.
      if (query === 'host:tiktok-bookmarklet') query = 'source:tiktok-bookmarklet';
      var migrated = {
        url:         s.url         || '',
        token:       s.token       || '',
        query:       query,
        gelfUrl:     s.gelfUrl     || DEFAULT_GELF_URL,
        autoRefresh: !!s.autoRefresh
      };
      if (migrated.query !== s.query || migrated.gelfUrl !== s.gelfUrl) saveSettings(migrated);
      return migrated;
    } catch (e) { return defaults(); }
  }
  function defaults() {
    return { url: '', token: '', query: 'source:tiktok-bookmarklet', gelfUrl: DEFAULT_GELF_URL, autoRefresh: false };
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
    els.dashboard.classList.toggle('hidden', !!yes);
    els.empty.classList.toggle('hidden', !yes);
    if (yes && msg) $('emptyStateMsg').textContent = msg;
    syncRouteFromScroll();
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

  // ── Combined view ────────────────────────────────────────────────
  //
  // "Combine" is a campaign-head toggle (defaults on) that collapses the
  // list into a single synthetic row showing the AVERAGE completion %
  // across every active campaign, plus an aggregated per-creator slice
  // bar so the manager still sees who's pulling weight. The smooth-arc
  // ring (no per-video segments) signals at a glance that this row is
  // an aggregate, not a single campaign.
  //
  // State persists in localStorage so the manager's preference survives
  // OTA reloads. Defaults to combined per the brief.
  var COMBINED_KEY = 'tok-scrape.campaigns.combined.v1';

  function isCombined() {
    try {
      var v = localStorage.getItem(COMBINED_KEY);
      // Default = on. Only "0" turns it off.
      return v !== '0';
    } catch (e) { return true; }
  }
  function setCombined(on) {
    try { localStorage.setItem(COMBINED_KEY, on ? '1' : '0'); } catch (e) {}
  }

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

  // Smooth-arc ring (no segment beads) used by the combined row. Stroke
  // is the primary brand color; flips to --success once the average is
  // 100%. Centered text shows the average %.
  function combinedRingSvg(avgPct) {
    var size   = 44;
    var stroke = 4;
    var r      = (size - stroke) / 2;
    var cx     = size / 2, cy = size / 2;
    var circ   = 2 * Math.PI * r;
    var pct    = Math.max(0, Math.min(100, avgPct | 0));
    var drawn  = circ * (pct / 100);
    var done   = pct >= 100;
    var color  = done ? 'var(--success)' : 'var(--primary)';

    return ''
      + '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true">'
      +   '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">'
      +     '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"'
      +       ' fill="none" stroke="rgba(242,241,237,0.10)" stroke-width="' + stroke + '"/>'
      +     (drawn > 0.01
        ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"'
          + ' fill="none" stroke="' + color + '" stroke-width="' + stroke + '"'
          + ' stroke-dasharray="' + drawn.toFixed(2) + ' ' + (circ - drawn).toFixed(2) + '"'
          + ' stroke-linecap="round" />'
        : '')
      +   '</g>'
      +   '<text x="' + cx + '" y="' + (cy + 0.5) + '" text-anchor="middle" dominant-baseline="central"'
      +     ' font-family="\'Avenir Next\',\'SF Pro Text\',sans-serif" font-size="11" font-weight="700"'
      +     ' fill="' + (done ? 'var(--success)' : 'var(--foreground)') + '">' + pct + '%</text>'
      + '</svg>';
  }

  // Build the single row HTML representing every active campaign at once.
  // The stacked bar aggregates each creator's contribution across ALL
  // campaigns; widths are normalised so the bar always sums to 100% when
  // the aggregate is complete (and proportionally less when it isn't).
  function combinedRowHtml(list) {
    var totalReq  = 0;
    var totalDone = 0;
    var perCreator = Object.create(null); // handle -> count

    list.forEach(function (c) {
      totalReq  += c.postsRequired || 0;
      totalDone += postsCompletedOf(c);
      (c.contributions || []).forEach(function (ctr) {
        var k = String(ctr.creator || '').toLowerCase();
        if (!k) return;
        perCreator[k] = (perCreator[k] || 0) + Math.max(0, ctr.count | 0);
      });
    });

    var avg = avgCampaignPct(list);

    // Slice widths use totalReq as the denominator so the unfilled tail
    // of the bar honestly represents work still owed. (If we normalised
    // by totalDone, an empty board would still show a full bar.)
    var slices = '';
    Object.keys(perCreator).forEach(function (handle) {
      var n = perCreator[handle];
      var w = totalReq > 0 ? (n / totalReq) * 100 : 0;
      if (w <= 0) return;
      slices +=
        '<span class="campaign-bar-slice" title="' + escapeHtml(handle)
        + ' · ' + n + ' video' + (n === 1 ? '' : 's')
        + '" style="width:' + w.toFixed(2) + '%;background:'
        + colorForHandle(handle) + '"></span>';
    });

    var deadline = list.length + ' campaign' + (list.length === 1 ? '' : 's');

    return ''
      + '<li class="campaign-row campaign-row--combined" role="button" tabindex="0" data-campaign-id="__combined">'
      +   '<span class="campaign-icon campaign-icon--ring campaign-icon--combined" aria-hidden="true">'
      +     combinedRingSvg(avg)
      +   '</span>'
      +   '<div class="campaign-main">'
      +     '<div class="campaign-headline">'
      +       '<span class="campaign-brand">'
      +         'Combined'
      +         '<span class="campaign-brand-tag" aria-hidden="true">avg</span>'
      +       '</span>'
      +       '<span class="campaign-deadline">'
      +         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      +           '<rect x="3" y="5" width="18" height="16" rx="2"/>'
      +           '<path d="M3 9h18"/>'
      +           '<path d="M8 3v4M16 3v4"/>'
      +         '</svg>'
      +         escapeHtml(deadline)
      +       '</span>'
      +     '</div>'
      +     '<div class="campaign-progress">'
      +       '<span class="campaign-bar">' + slices + '</span>'
      +       '<span class="campaign-count">' + totalDone + '/' + totalReq + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<span class="campaign-chevron" aria-hidden="true">'
      +     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      +       '<polyline points="9 6 15 12 9 18"/>'
      +     '</svg>'
      +   '</span>'
      + '</li>';
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

  function renderActiveCampaigns(list) {
    // OTA bundles ship CSS+JS only — index.html is whatever shipped in
    // the installed APK. The section may or may not exist, and when it
    // does its head may predate the redesign (older shells render a
    // serif "Active Campaigns" h2 with View all, no Combine button).
    // Create the section if it's missing, then unconditionally normalize
    // the head so the new heading style and Combine toggle land via OTA
    // regardless of what the bundled index.html shipped.
    var headHtml =
      '<h2 class="campaigns-title">Campaigns</h2>' +
      '<div class="campaigns-head-actions">' +
        '<button type="button" class="campaigns-combine" id="campaignsCombine" role="switch" aria-checked="false" aria-label="Combine campaigns into a single average">' +
          '<svg class="campaigns-combine-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
            '<circle cx="8" cy="9" r="4"/>' +
            '<circle cx="16" cy="9" r="4"/>' +
            '<path d="M5 20a6 6 0 0 1 14 0"/>' +
          '</svg>' +
          '<span class="campaigns-combine-label">Combine</span>' +
        '</button>' +
      '</div>';

    var card = document.getElementById('activeCampaignsCard');
    if (!card) {
      var dash = document.getElementById('dashboard');
      if (!dash) return;
      card = document.createElement('section');
      card.id = 'activeCampaignsCard';
      card.className = 'card card-wide campaigns-block';
      card.setAttribute('data-route-target', 'campaigns');
      card.innerHTML =
        '<div class="campaigns-head">' + headHtml + '</div>' +
        '<ul class="campaign-list" id="campaignList"></ul>';
      dash.insertBefore(card, dash.firstChild);
    }

    // Normalize the head if the bundled markup is the older shape
    // (missing the Combine button, still using the serif "Active
    // Campaigns" h2, or still rendering a View-all). Idempotent — once
    // upgraded the selector matches and we leave the head alone on
    // subsequent renders.
    var head = card.querySelector('.campaigns-head');
    if (head && (!head.querySelector('.campaigns-combine-label') || head.querySelector('#campaignsViewAll'))) {
      head.innerHTML = headHtml;
      card.__headBound = false;
    }

    // Wire up the Combine button once per card (the flag is reset above
    // whenever we rebuild the head, so the new node gets a fresh listener).
    if (!card.__headBound) {
      var combineBtnInit = document.getElementById('campaignsCombine');
      if (combineBtnInit) {
        combineBtnInit.addEventListener('click', function () {
          setCombined(!isCombined());
          renderActiveCampaigns(card.__campaignsList || []);
        });
      }
      card.__headBound = true;
    }

    var ul = document.getElementById('campaignList');
    if (!ul) return;
    var items = Array.isArray(list) && list.length ? list : [];

    // Stash the list on the card element so the Combine toggle can
    // re-render without needing a fresh fetch.
    card.__campaignsList = items;

    // Reflect the toggle state on the button so the SPLIT/COMBINE label
    // and aria stay in sync with localStorage.
    var combined = isCombined();
    var combineBtn = document.getElementById('campaignsCombine');
    if (combineBtn) {
      combineBtn.setAttribute('aria-checked', combined ? 'true' : 'false');
      combineBtn.classList.toggle('is-on', combined);
      var lbl = combineBtn.querySelector('.campaigns-combine-label');
      if (lbl) lbl.textContent = combined ? 'Split' : 'Combine';
      combineBtn.setAttribute('aria-label', combined ? 'Split combined campaigns' : 'Combine campaigns into a single average');
    }

    if (!items.length) {
      ul.innerHTML = '<li class="campaign-empty">No active campaigns yet.</li>';
      return;
    }

    ul.innerHTML = combined
      ? combinedRowHtml(items)
      : items.map(campaignRowHtml).join('');
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

  function refresh() {
    if (loading) return;

    var s = loadSettings();
    if (!s.url || !s.token) {
      showEmpty(true, 'Set your Graylog URL and API token in Settings, then refresh.');
      return;
    }
    showEmpty(false);
    loading = true;
    showError('');

    var rangeSec = parseInt(els.range.value, 10) || 0;
    var creatorFilter = Users.getCreatorFilters();   // null for "All Accounts"
    var client = new GraylogClient({ baseUrl: s.url, token: s.token });

    Promise.all([
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
      })
    ])
      .then(function (results) {
        var videoScrapes    = results[0];
        var liveScrapes     = results[1];
        var affiliateRows   = results[2] || [];
        var overviewScrapes = results[3] || [];
        var caScrapes       = results[4] || [];
        var hasVideos    = videoScrapes.length > 0;
        var hasLive      = liveScrapes.length > 0;
        var hasAffiliate = affiliateRows.length > 0;
        var hasOverview  = overviewScrapes.length > 0;
        var hasCa        = caScrapes.length > 0;

        // Map rangeSec → required inclusive day-span for the Data Overview
        // card. Today = 1-day snapshots, Last 7d = 7-day snapshots; other
        // ranges keep the existing "most recent regardless of span" behavior.
        var spanForOverview = null;
        if (rangeSec === 86400)  spanForOverview = 0;
        if (rangeSec === 604800) spanForOverview = 6;

        // Overview card hides itself when no metrics; renderOverview also
        // toggles .hidden, so we just call it unconditionally.
        Dashboard.renderOverview(overviewScrapes, { spanDays: spanForOverview });
        Dashboard.renderCreatorAnalytics(caScrapes);

        if (rangeSec === 86400) {
          setTodayOnlyMode(true);
          // renderOverview hides the card when there are no single-day
          // snapshots; surface the empty state so the user isn't staring
          // at a blank dashboard.
          var card = document.getElementById('overviewCard');
          var overviewShown = card && !card.classList.contains('hidden');
          if (overviewShown) {
            showEmpty(false);
          } else {
            var todayMsg = creatorFilter
              ? 'No "Today" snapshots found for ' + creatorFilter.join(', ') + '. Run the bookmarklet on the Data Overview page with the Today filter selected.'
              : 'No "Today" snapshots found. Run the bookmarklet on the Data Overview page with the Today filter selected.';
            showEmpty(true, todayMsg);
          }
          return;
        }
        setTodayOnlyMode(false);

        setToggleVisibility(hasVideos && hasLive);
        setAffiliateBlockVisibility(hasAffiliate);

        var mode = getMode();
        if (mode === 'videos' && !hasVideos && hasLive)  { setMode('live');   mode = 'live'; }
        else if (mode === 'live' && !hasLive && hasVideos) { setMode('videos'); mode = 'videos'; }

        if (!hasVideos && !hasLive && !hasAffiliate && !hasOverview && !hasCa) {
          var msg = creatorFilter
            ? 'No scrapes found for ' + creatorFilter.join(', ') + ' in the selected range.'
            : 'No scrapes found in the selected range.';
          showEmpty(true, msg);
          return;
        }
        showEmpty(false);
        if (mode === 'live') Dashboard.renderLive(liveScrapes);
        else if (hasVideos)  Dashboard.renderVideos(videoScrapes);
        if (hasAffiliate)    Dashboard.renderAffiliate(affiliateRows);
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
    renderActiveCampaigns(MOCK_CAMPAIGNS);
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
