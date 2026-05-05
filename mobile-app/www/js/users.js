// Users for the TokScrape dashboard.
//
// There's no real auth here — this is a local analytics tool that uses a single
// Graylog API token (stored in Settings) to talk to Graylog. The roster is:
//   - one hardcoded admin (Daniel)
//   - members derived dynamically from Graylog: each unique `creator` value
//     observed in the configured sources becomes a member entry.
//
// Roster drives:
//   - what the dashboard is filtered by (members only see their own creator)
//   - which menu items show (admins get "Admin" + "Login As...")
//
// "Login" = pick a user from a list modal. The selection is persisted in
// localStorage under tok-scrape.auth.v1.
//
// The admin's "Login As..." feature sets a separate `viewAs` flag
// (tok-scrape.viewAs.v1) that scopes the dashboard to one member without
// changing the admin's actual identity — a banner indicates the impersonation
// and lets the admin return to the admin view.
//
// Because the member list is fetched async, app.js awaits Users.ready() (which
// resolves after the first refresh attempt) before deciding whether the
// persisted auth points at a known user.

(function (global) {
  'use strict';

  // --- Roster ----------------------------------------------------------
  var ADMIN = {
    id:      'daniel',
    name:    'Daniel',
    email:   'daniel@easierbycode.com',
    role:    'admin',
    creator: null,                    // admin has no creator of their own
    avatar:  'LP'
  };

  var creators = [];                  // [{id, name, role:'member', creator, avatar}]

  // Resolves after the first refresh() attempt (success or failure) so the app
  // can decide post-load what to do with any persisted auth state.
  var readyResolve;
  var readyPromise = new Promise(function (resolve) { readyResolve = resolve; });
  var readyFired = false;
  function fireReady() { if (!readyFired) { readyFired = true; readyResolve(); } }

  function handleToId(handle) {
    return String(handle || '').replace(/^@+/, '').toLowerCase();
  }
  function handleToAvatar(handle) {
    var s = String(handle || '').replace(/^@+/, '');
    return (s.slice(0, 2) || '??').toUpperCase();
  }
  function makeCreator(handle) {
    var id = handleToId(handle);
    if (!id || id === ADMIN.id) return null;
    return {
      id:      id,
      name:    id,
      email:   '',
      role:    'member',
      creator: handle.charAt(0) === '@' ? handle : '@' + handle,
      avatar:  handleToAvatar(handle)
    };
  }

  // --- Storage ---------------------------------------------------------
  var AUTH_KEY    = 'tok-scrape.auth.v1';
  var VIEW_AS_KEY = 'tok-scrape.viewAs.v1';

  function readAuth() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.userId ? parsed : null;
    } catch (e) { return null; }
  }
  function writeAuth(userId) {
    if (!userId) { localStorage.removeItem(AUTH_KEY); return; }
    localStorage.setItem(AUTH_KEY, JSON.stringify({ userId: userId }));
  }

  function readViewAs() {
    try { return localStorage.getItem(VIEW_AS_KEY) || null; } catch (e) { return null; }
  }
  function writeViewAs(userId) {
    if (!userId) { localStorage.removeItem(VIEW_AS_KEY); return; }
    localStorage.setItem(VIEW_AS_KEY, String(userId));
  }

  // --- Queries ---------------------------------------------------------

  function byId(id) {
    if (!id) return null;
    if (id === ADMIN.id) return ADMIN;
    for (var i = 0; i < creators.length; i++) if (creators[i].id === id) return creators[i];
    return null;
  }

  function getCurrentUser() {
    var a = readAuth();
    return a ? byId(a.userId) : null;
  }

  function getViewAsUser() {
    var u = getCurrentUser();
    if (!u || u.role !== 'admin') return null;       // view-as only applies to admins
    var vid = readViewAs();
    return vid ? byId(vid) : null;
  }

  // The user whose data the dashboard is currently scoped to.
  //   - Member logged in: themselves
  //   - Admin, not impersonating: null (= aggregate view across everyone)
  //   - Admin, impersonating @x: the impersonated member
  function getEffectiveUser() {
    var u = getCurrentUser();
    if (!u) return null;
    if (u.role === 'admin') return getViewAsUser();  // may be null -> admin aggregate
    return u;
  }

  // Convenience: the creator handle the dashboard should filter by, or null
  // for "no filter" (admin aggregate).
  function getCreatorFilter() {
    var eff = getEffectiveUser();
    return eff ? eff.creator : null;
  }

  function members() { return creators.slice(); }
  function all()     { return [ADMIN].concat(creators); }

  // --- Actions ---------------------------------------------------------

  function login(userId) {
    if (!byId(userId)) throw new Error('Unknown user: ' + userId);
    writeAuth(userId);
    writeViewAs(null);  // login resets any impersonation
  }
  function logout() { writeAuth(null); writeViewAs(null); }

  function loginAs(userId) {
    var me = getCurrentUser();
    if (!me || me.role !== 'admin') throw new Error('Only admins can Login As another user');
    if (!userId) { writeViewAs(null); return; }
    var target = byId(userId);
    if (!target) throw new Error('Unknown user: ' + userId);
    if (target.role === 'admin') throw new Error('Cannot Login As another admin');
    writeViewAs(userId);
  }
  function clearLoginAs() { writeViewAs(null); }

  // --- Refresh from Graylog -------------------------------------------
  // Replaces the cached `creators` array with the unique creator handles
  // observed in Graylog. Resolves with the new array; rejects if the
  // request itself fails (the cache is left untouched in that case).
  // Always fires Users.ready() exactly once, on first call.
  function refresh(client, lucene, rangeSeconds) {
    if (!client || typeof client.fetchCreators !== 'function') {
      fireReady();
      return Promise.reject(new Error('refresh requires a GraylogClient'));
    }
    return client.fetchCreators(lucene, rangeSeconds)
      .then(function (handles) {
        var next = [];
        var seenIds = Object.create(null);
        (handles || []).forEach(function (h) {
          var entry = makeCreator(h);
          if (entry && !seenIds[entry.id]) { seenIds[entry.id] = true; next.push(entry); }
        });
        next.sort(function (a, b) { return a.name.localeCompare(b.name); });
        creators = next;
        return creators.slice();
      })
      .then(
        function (out) { fireReady(); return out; },
        function (err) { fireReady(); throw err; }
      );
  }

  function ready() { return readyPromise; }

  // --- Exports ---------------------------------------------------------
  global.Users = {
    all:              all,
    members:          members,
    byId:             byId,
    getCurrentUser:   getCurrentUser,
    getViewAsUser:    getViewAsUser,
    getEffectiveUser: getEffectiveUser,
    getCreatorFilter: getCreatorFilter,
    login:            login,
    logout:           logout,
    loginAs:          loginAs,
    clearLoginAs:     clearLoginAs,
    refresh:          refresh,
    ready:            ready
  };
})(window);
