// Users for the TokScrape dashboard.
//
// There's no real auth here — this is a local analytics tool that uses a single
// Graylog API token (stored in Settings) to talk to Graylog.
//
// Roster:
//   - one hidden admin (Daniel) — not surfaced in the picker; admin-only menu
//     items render iff Users.isAdmin() is true (set by a legacy localStorage
//     entry or the build-time preload). The admin's privileges are limited to
//     unlocking the "Login As / Switch account" menu in app.js.
//   - members derived from Graylog: each unique `creator` value observed in
//     the configured sources becomes a member entry. The build-time preload
//     can also pin handles (newly-onboarded creators waiting for their first
//     scrape) so they always show up.
//
// Selection model: the dashboard is "scoped" to one of:
//   - '__all'      -- aggregate across every roster entry
//   - ['id', ...]  -- one or more roster ids; non-empty
//
// Multi-id scopes aggregate scrapes across the listed creators. The Graylog
// query side reads getCreatorFilters() — null for '__all', or an array of
// "@handle" strings to OR together.
//
// State persists in localStorage under tok-scrape.auth.v1 as { userId, scope }.
// `userId` is legacy (admin only); `scope` is the new multi-select shape.
//
// Because the member list is fetched async, app.js awaits Users.ready() (which
// resolves after the first refresh attempt) before rendering the selector.

(function (global) {
  'use strict';

  // --- Roster ----------------------------------------------------------
  var ADMIN = {
    id:      'daniel',
    name:    'Daniel',
    role:    'admin',
    creator: null,
    avatar:  'LP'
  };

  // Build-time preload (mobile-app/scripts/build-preloaded.js) can publish a
  // list of handles via a global so they show up in the picker before the
  // first Graylog refresh and even when Graylog has no data for them yet.
  function preloadedExtras() {
    var seeded = global.__TOK_PRELOADED_ROSTER__;
    return Array.isArray(seeded) ? seeded.slice() : [];
  }

  var creators;                       // [{id, name, creator, avatar}]

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
      role:    'member',
      creator: handle.charAt(0) === '@' ? handle : '@' + handle,
      avatar:  handleToAvatar(handle)
    };
  }

  function buildCreators(handles) {
    var all = (handles || []).concat(preloadedExtras());
    var seenIds = Object.create(null);
    var out = [];
    all.forEach(function (h) {
      var entry = makeCreator(h);
      if (entry && !seenIds[entry.id]) { seenIds[entry.id] = true; out.push(entry); }
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }

  creators = buildCreators([]);

  // --- Storage ---------------------------------------------------------
  var AUTH_KEY = 'tok-scrape.auth.v1';

  function readAuth() {
    try {
      var raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return {};
      var p = JSON.parse(raw) || {};
      return p && typeof p === 'object' ? p : {};
    } catch (e) { return {}; }
  }
  function writeAuth(patch) {
    try {
      var cur = readAuth();
      var next = Object.assign({}, cur, patch);
      Object.keys(next).forEach(function (k) { if (next[k] == null) delete next[k]; });
      localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    } catch (e) { /* private mode / quota */ }
  }

  // Read scope: '__all' | non-empty array of ids. Defaults to '__all'.
  function readScope() {
    var p = readAuth();
    if (p.scope === '__all') return '__all';
    if (Array.isArray(p.scope) && p.scope.length) return p.scope.slice();
    return '__all';
  }
  function writeScope(scope) {
    if (scope === '__all') { writeAuth({ scope: '__all' }); return; }
    var ids = Array.isArray(scope) ? scope.filter(Boolean) : [];
    writeAuth({ scope: ids.length ? ids : '__all' });
  }

  // --- Queries ---------------------------------------------------------

  function byId(id) {
    if (!id) return null;
    if (id === ADMIN.id) return ADMIN;
    for (var i = 0; i < creators.length; i++) if (creators[i].id === id) return creators[i];
    return null;
  }

  function members() { return creators.slice(); }

  function isAdmin() { return readAuth().userId === ADMIN.id; }

  // Resolved scope: filters out ids that aren't in the current roster. May
  // return '__all' or an array of {id,name,creator,avatar} entries.
  function getScope() {
    var raw = readScope();
    if (raw === '__all') return '__all';
    var resolved = raw.map(byId).filter(Boolean);
    return resolved.length ? resolved : '__all';
  }

  // The Graylog `creator` filter for the current scope, or null when no
  // creator-side filtering should be applied (i.e. '__all').
  function getCreatorFilters() {
    var s = getScope();
    if (s === '__all') return null;
    return s.map(function (u) { return u.creator; });
  }

  // --- Mutations -------------------------------------------------------

  function setScope(scope) {
    if (scope === '__all') { writeScope('__all'); return; }
    if (Array.isArray(scope)) { writeScope(scope.filter(Boolean)); return; }
    writeScope([scope]);
  }
  function clearScope() { writeScope('__all'); }

  function toggle(id) {
    var raw = readScope();
    var ids = raw === '__all' ? [] : raw.slice();
    var i = ids.indexOf(id);
    if (i === -1) ids.push(id);
    else          ids.splice(i, 1);
    writeScope(ids.length ? ids : '__all');
  }

  // --- Refresh from Graylog -------------------------------------------
  function refresh(client, lucene, rangeSeconds) {
    if (!client || typeof client.fetchCreators !== 'function') {
      fireReady();
      return Promise.reject(new Error('refresh requires a GraylogClient'));
    }
    return client.fetchCreators(lucene, rangeSeconds)
      .then(function (handles) {
        creators = buildCreators(handles);
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
    members:           members,
    byId:              byId,
    isAdmin:           isAdmin,
    getScope:          getScope,
    getCreatorFilters: getCreatorFilters,
    setScope:          setScope,
    toggle:            toggle,
    clearScope:        clearScope,
    refresh:           refresh,
    ready:             ready
  };
})(window);
