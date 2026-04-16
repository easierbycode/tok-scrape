// Scaffolded users for the TokScrape dashboard.
//
// There's no real auth here — this is a local analytics tool that uses a single
// Graylog API token (stored in Settings) to talk to Graylog. The user roster
// below is a *client-side* mapping from display name -> role -> creator handle
// that drives:
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

(function (global) {
  'use strict';

  // --- Roster ----------------------------------------------------------
  // Edit this list to add/remove members. `id` is stored in localStorage, so
  // changing it for an existing user will log them out. `creator` must match
  // the `creator` field the bookmarklet sends to Graylog (the TikTok handle
  // including the leading @).
  var USERS = [
    {
      id:      'daniel',
      name:    'Daniel',
      email:   'daniel@easierbycode.com',
      role:    'admin',
      creator: null,                    // admin has no creator of their own
      avatar:  'LP'
    },
    {
      id:      'wizardofdealz',
      name:    'Wizard of Dealz',
      email:   'wizard@wizardofdealz.example',
      role:    'member',
      creator: '@wizardofdealz',
      avatar:  'WD'
    },
    {
      id:      'beautybybri',
      name:    'Beauty by Bri',
      email:   'bri@beautybybri.example',
      role:    'member',
      creator: '@beautybybri',
      avatar:  'BB'
    },
    {
      id:      'techguruak',
      name:    'Tech Guru AK',
      email:   'ak@techguruak.example',
      role:    'member',
      creator: '@techguruak',
      avatar:  'AK'
    },
    {
      id:      'fitnesswithmia',
      name:    'Fitness with Mia',
      email:   'mia@fitnesswithmia.example',
      role:    'member',
      creator: '@fitnesswithmia',
      avatar:  'FM'
    },
    {
      id:      'cookingwithkenji',
      name:    'Cooking with Kenji',
      email:   'kenji@cookingwithkenji.example',
      role:    'member',
      creator: '@cookingwithkenji',
      avatar:  'CK'
    }
  ];

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
    for (var i = 0; i < USERS.length; i++) if (USERS[i].id === id) return USERS[i];
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

  function members() {
    return USERS.filter(function (u) { return u.role === 'member'; });
  }

  function all() { return USERS.slice(); }

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
    clearLoginAs:     clearLoginAs
  };
})(window);
