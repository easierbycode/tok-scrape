// App bootstrap: auth, settings, refresh loop, error handling.
//
// Auth model (see users.js for the roster):
//   - On first launch, the "Sign in" modal pops up. Picking a user persists
//     their id in localStorage.
//   - Members see ONLY their own data (the Graylog query is AND'd with
//     creator:"<handle>").
//   - Admin sees an aggregate across everyone by default, and the user menu
//     exposes:
//         * Admin       — returns to the aggregate admin view
//         * Login As... — picks a member to "view as"; a banner appears
//                         announcing the impersonation, and the dashboard is
//                         scoped to that member. The admin's own login is
//                         unchanged; clicking "Return to Admin" clears the
//                         impersonation.

(function () {
  'use strict';

  var SETTINGS_KEY = 'tok-scrape.settings.v1';
  var els = {};
  var autoTimer = null;
  var loading = false;
  var routeLock = null;

  // -------- Settings persistence -----------------------------------

  function $(id) { return document.getElementById(id); }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return defaults();
      var s = JSON.parse(raw);
      return {
        url:         s.url         || '',
        token:       s.token       || '',
        query:       s.query       || 'host:tiktok-bookmarklet',
        autoRefresh: !!s.autoRefresh
      };
    } catch (e) { return defaults(); }
  }
  function defaults() {
    return { url: '', token: '', query: 'host:tiktok-bookmarklet', autoRefresh: false };
  }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

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
    var offset = els.topbar ? els.topbar.offsetHeight + 20 : 96;
    if (els.banner && !els.banner.classList.contains('hidden')) offset += els.banner.offsetHeight;
    return offset;
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

  function syncRouteFromScroll() {
    if (routeLock) {
      setRoute(routeLock);
      return;
    }
    if (!document.body) return;

    var route = 'home';
    var checkpoint = window.scrollY + currentStickyOffset() + 24;

    if (els.goalsSection && checkpoint >= els.goalsSection.offsetTop) route = 'goals';
    else if (els.campaignsSection && checkpoint >= els.campaignsSection.offsetTop) route = 'campaigns';

    setRoute(route);
  }

  function toggleProfileSurface() {
    lockRoute('profile');
    if (!Users.getCurrentUser()) {
      openSignIn();
      return;
    }
    if (els.userDropdown.classList.contains('hidden')) openDropdown();
    else closeDropdown();
  }

  function bindBottomNav() {
    if (!els.bottomnav) return;

    els.bottomnav.addEventListener('click', function (ev) {
      var item = ev.target.closest && ev.target.closest('.item');
      if (!item) return;

      var route = item.getAttribute('data-route');

      if (route === 'home') {
        closeDropdown();
        routeLock = null;
        setRoute('home');
        scrollToY(0);
        return;
      }
      if (route === 'campaigns') {
        closeDropdown();
        scrollToSection(els.campaignsSection, 'campaigns');
        return;
      }
      if (route === 'goals') {
        closeDropdown();
        scrollToSection(els.goalsSection, 'goals');
        return;
      }
      if (route === 'profile') {
        toggleProfileSurface();
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
    $('setAutoRefresh').checked = s.autoRefresh;
    els.settingsModal.classList.remove('hidden');
  }
  function closeSettings() { els.settingsModal.classList.add('hidden'); }

  function persistFromForm() {
    var s = {
      url:         $('setUrl').value.trim().replace(/\/+$/, ''),
      token:       $('setToken').value.trim(),
      query:       $('setQuery').value.trim() || 'host:tiktok-bookmarklet',
      autoRefresh: $('setAutoRefresh').checked
    };
    saveSettings(s);
    return s;
  }

  // -------- Auth / user menu --------------------------------------

  function renderUserButton() {
    var u = Users.getCurrentUser();
    if (!u) {
      $('userAvatar').textContent = '?';
      $('userLabel').textContent  = 'Sign in';
      return;
    }
    $('userAvatar').textContent = u.avatar || (u.name || '?').slice(0, 2).toUpperCase();
    $('userLabel').textContent  = u.role === 'admin' ? 'Admin' : u.name;
  }

  function renderUserDropdown() {
    var u = Users.getCurrentUser();
    var dd = $('userDropdown');
    dd.innerHTML = '';

    if (!u) {
      dd.appendChild(menuItem('Sign in\u2026', function () { openSignIn(); closeDropdown(); }));
      return;
    }

    // Header: who am I / effective view
    var header = document.createElement('div');
    header.className = 'user-dd-header';
    var viewAs = Users.getViewAsUser();
    header.innerHTML =
      '<div class="user-dd-name">' + escapeHtml(u.name) + '</div>' +
      '<div class="user-dd-meta">' + escapeHtml(u.email || '') + ' \u00B7 ' + escapeHtml(u.role) + '</div>' +
      (viewAs ? '<div class="user-dd-meta impersonating">Viewing as ' + escapeHtml(viewAs.name) + '</div>' : '');
    dd.appendChild(header);
    dd.appendChild(divider());

    if (u.role === 'admin') {
      // "Admin" menu item: returns to aggregate view by clearing any Login-As.
      var adminItem = menuItem('Admin dashboard', function () {
        Users.clearLoginAs();
        closeDropdown();
        reflectAuthChange();
      });
      if (!viewAs) adminItem.classList.add('active');
      dd.appendChild(adminItem);

      dd.appendChild(menuItem('Login As\u2026', function () {
        closeDropdown();
        openLoginAs();
      }));

      dd.appendChild(divider());
    }

    dd.appendChild(menuItem('Switch user\u2026', function () {
      closeDropdown();
      openSignIn();
    }));
    dd.appendChild(menuItem('Sign out', function () {
      Users.logout();
      closeDropdown();
      reflectAuthChange();
      openSignIn();
    }));
  }

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

  function openDropdown() {
    lockRoute('profile');
    renderUserDropdown();
    els.userDropdown.classList.remove('hidden');
    els.userBtn.setAttribute('aria-expanded', 'true');
    // Next-frame listener so this same click doesn't immediately close it.
    setTimeout(function () {
      document.addEventListener('click', outsideClickCloser, { once: true });
    }, 0);
  }
  function closeDropdown() {
    els.userDropdown.classList.add('hidden');
    els.userBtn.setAttribute('aria-expanded', 'false');
    if (routeLock === 'profile') unlockRoute();
  }
  function outsideClickCloser(ev) {
    if (ev.target.closest && ev.target.closest('.user-menu')) {
      // Re-arm for the next outside click if they clicked inside.
      document.addEventListener('click', outsideClickCloser, { once: true });
      return;
    }
    closeDropdown();
  }

  // -------- Sign-in modal -----------------------------------------

  function openSignIn() {
    lockRoute('profile');
    var list = $('signInList');
    list.innerHTML = '';
    Users.all().forEach(function (u) {
      list.appendChild(userCard(u, function () {
        Users.login(u.id);
        closeSignIn();
        reflectAuthChange();
        refresh();
      }));
    });
    els.signInModal.classList.remove('hidden');
  }
  function closeSignIn() {
    els.signInModal.classList.add('hidden');
    if (routeLock === 'profile') unlockRoute();
  }

  // -------- Login-As modal (admin only) ---------------------------

  function openLoginAs() {
    lockRoute('profile');
    var list = $('loginAsList');
    list.innerHTML = '';
    Users.members().forEach(function (u) {
      list.appendChild(userCard(u, function () {
        Users.loginAs(u.id);
        closeLoginAs();
        reflectAuthChange();
        refresh();
      }));
    });
    els.loginAsModal.classList.remove('hidden');
  }
  function closeLoginAs() {
    els.loginAsModal.classList.add('hidden');
    if (routeLock === 'profile') unlockRoute();
  }

  function userCard(u, onClick) {
    var row = document.createElement('button');
    row.type = 'button';
    row.className = 'user-row';
    row.innerHTML =
      '<span class="avatar">' + escapeHtml(u.avatar || u.name.slice(0, 2).toUpperCase()) + '</span>' +
      '<span class="user-row-text">' +
        '<span class="user-row-name">' + escapeHtml(u.name) + '</span>' +
        '<span class="user-row-meta">' + escapeHtml(u.email || '') + ' \u00B7 ' + escapeHtml(u.role) + (u.creator ? ' \u00B7 ' + escapeHtml(u.creator) : '') + '</span>' +
      '</span>';
    row.addEventListener('click', onClick);
    return row;
  }

  // -------- View-as banner ----------------------------------------

  function renderBanner() {
    var viewAs = Users.getViewAsUser();
    if (!viewAs) { els.banner.classList.add('hidden'); return; }
    $('viewAsName').textContent = viewAs.name + ' (' + (viewAs.creator || '') + ')';
    els.banner.classList.remove('hidden');
  }

  // Anything that could shift what the user sees: re-render the nav + banner
  // + dashboard labels. Callers then usually call refresh() to re-fetch data.
  function reflectAuthChange() {
    renderUserButton();
    renderBanner();
    updateAdminLabels();
    syncRouteFromScroll();
  }

  // The "Creators" KPI and pie chart make sense as an aggregate (admin) but
  // not for a single member's view, where there's exactly one creator. Swap
  // the labels/title so they read naturally.
  function updateAdminLabels() {
    var eff = Users.getEffectiveUser();
    var isAggregate = !eff;
    $('kpiCreatorsLabel').textContent   = isAggregate ? 'Creators' : 'Creator';
    $('creatorsChartTitle').textContent = isAggregate ? 'Scrapes per creator' : 'Scrapes over time';
  }

  // -------- Refresh loop ------------------------------------------

  function refresh() {
    if (loading) return;

    var u = Users.getCurrentUser();
    if (!u) { openSignIn(); showEmpty(true, 'Sign in to view a dashboard.'); return; }

    var s = loadSettings();
    if (!s.url || !s.token) {
      showEmpty(true, 'Set your Graylog URL and API token in Settings, then refresh.');
      return;
    }
    showEmpty(false);
    loading = true;
    els.refresh.disabled = true;
    showError('');

    var rangeSec = parseInt(els.range.value, 10) || 0;
    var creatorFilter = Users.getCreatorFilter();   // null for admin aggregate
    var client = new GraylogClient({ baseUrl: s.url, token: s.token });

    client.fetchScrapes(s.query, rangeSec, creatorFilter)
      .then(function (scrapes) {
        if (!scrapes.length) {
          var msg = creatorFilter
            ? 'No scrapes found for ' + creatorFilter + ' in the selected range.'
            : 'No scrapes found in the selected range.';
          showEmpty(true, msg);
          return;
        }
        showEmpty(false);
        Dashboard.render(scrapes, { effectiveUser: Users.getEffectiveUser() });
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
        els.refresh.disabled = false;
      });
  }

  function setupAutoRefresh() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var s = loadSettings();
    if (s.autoRefresh) autoTimer = setInterval(refresh, 60 * 1000);
  }

  // -------- Misc --------------------------------------------------

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  function bind() {
    els.refresh.addEventListener('click', refresh);
    els.range.addEventListener('change', refresh);
    els.settingsBtn.addEventListener('click', openSettings);
    $('emptySettingsBtn').addEventListener('click', openSettings);
    $('setCancel').addEventListener('click', closeSettings);
    $('setSave').addEventListener('click', function () {
      persistFromForm();
      closeSettings();
      setupAutoRefresh();
      refresh();
    });

    // User menu
    els.userBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (els.userDropdown.classList.contains('hidden')) openDropdown();
      else closeDropdown();
    });

    // Sign-in modal
    $('signInCancel').addEventListener('click', closeSignIn);

    // Login-As modal
    $('loginAsCancel').addEventListener('click', closeLoginAs);

    // View-as banner
    $('viewAsExit').addEventListener('click', function () {
      Users.clearLoginAs();
      reflectAuthChange();
      refresh();
    });

    document.addEventListener('deviceready', function () {
      if (window.StatusBar) StatusBar.styleLightContent();
    }, false);

    bindBottomNav();
  }

  function init() {
    els.dashboard     = $('dashboard');
    els.empty         = $('emptyState');
    els.err           = $('errorBanner');
    els.settingsModal = $('settingsModal');
    els.signInModal   = $('signInModal');
    els.loginAsModal  = $('loginAsModal');
    els.range         = $('rangeSel');
    els.refresh       = $('refreshBtn');
    els.settingsBtn   = $('settingsBtn');
    els.userBtn       = $('userBtn');
    els.userDropdown  = $('userDropdown');
    els.banner        = $('viewAsBanner');
    els.topbar        = document.querySelector('.topbar');
    els.bottomnav     = document.querySelector('.bottomnav');
    els.campaignsSection = $('campaignsSection');
    els.goalsSection  = $('goalsSection');

    if (window.Highcharts && window.Dashboard) Dashboard.applyTheme();
    bind();
    reflectAuthChange();
    setupAutoRefresh();

    if (!Users.getCurrentUser()) openSignIn();
    else refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
