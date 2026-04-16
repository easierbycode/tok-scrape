/*
 * LP branding patch for Graylog Open's web UI.
 *
 * Graylog's login screen and top-nav logos are rendered as inline SVGs by the
 * React app (notably the SVG with id="logoTitleId" on /login). We can't change
 * them at build time without rebuilding the JS bundle, so this shim watches
 * the DOM and replaces the relevant SVGs with the LP logo as soon as React
 * mounts them.
 *
 * Works by:
 *   1. Loading the LP SVG once (served as /assets/lp-logo.svg by the same
 *      Dockerfile that drops this script into Graylog's web root).
 *   2. Replacing matched nodes via outerHTML so React's later re-renders are
 *      caught by the MutationObserver and re-replaced.
 *   3. Hiding the "Security" and "Enterprise" top-nav tabs (Graylog Open
 *      7.x ships both sections but they're only useful with an Enterprise
 *      license). We do this with both a CSS rule (covers most cases) and
 *      a belt-and-braces JS pass in the MutationObserver that removes any
 *      navbar <a>/<button>/<menuitem> whose href is /security or
 *      /enterprise, or whose visible text is exactly "Security" or
 *      "Enterprise".
 *
 * If Graylog Enterprise's "Custom Branding" plugin is later installed this
 * shim becomes redundant; remove the <script> tag and rebuild.
 */
(function () {
  'use strict';

  var LP_SVG_URL = '/assets/lp-logo.svg';
  var lpSvgInlineCache = null;

  // --- Hide the "Security" and "Enterprise" tabs ------------------------
  // Graylog Open 7.x renders Security and Enterprise sections in the top
  // navbar. Both require an Enterprise license to be useful, so hide them
  // outright for the LP deployment.
  //
  // Each entry is (href-prefix-or-exact, label, test-id). The test-id is
  // how Graylog labels nav items in its CSS-in-JS components; labels are
  // matched against the element's trimmed visible text case-insensitively.
  var HIDDEN_TABS = [
    { path: '/security',   label: 'Security',   testId: 'Security'   },
    { path: '/enterprise', label: 'Enterprise', testId: 'Enterprise' }
  ];

  function buildHideCss() {
    var selectors = [];
    HIDDEN_TABS.forEach(function (t) {
      selectors.push('a[href="'   + t.path + '"]');
      selectors.push('a[href^="' + t.path + '/"]');
      selectors.push('a[href^="' + t.path + '?"]');
      selectors.push('[data-testid="nav-item-' + t.testId + '"]');
      selectors.push('[data-testid="nav-item-' + t.testId.toLowerCase() + '"]');
      selectors.push('[role="navigation"] [aria-label="' + t.label + '"]');
      selectors.push('[role="navigation"] [aria-label="' + t.label.toLowerCase() + '"]');
    });
    return selectors.join(',') +
      '{display:none!important;visibility:hidden!important;}';
  }

  function injectHideCss() {
    if (document.getElementById('lp-hide-tabs-style')) return;
    var style = document.createElement('style');
    style.id = 'lp-hide-tabs-style';
    style.type = 'text/css';
    style.appendChild(document.createTextNode(buildHideCss()));
    (document.head || document.documentElement).appendChild(style);
  }

  // Belt-and-braces JS pass: walks the navbar and drops any <a>/<button>/
  // <menuitem> whose href matches one of HIDDEN_TABS or whose visible text
  // is exactly one of the suppressed labels. Runs on each MutationObserver
  // tick so it catches React's async mounts and route changes.
  function hideTabs(root) {
    if (!root || !root.querySelectorAll) return;
    var nav = root.closest ? root.closest('[role="navigation"],nav,header') : null;
    // If `root` isn't inside a nav, search all navs in root.
    var scopes = nav ? [nav] : root.querySelectorAll('[role="navigation"],nav,header');
    if (!scopes || !scopes.length) scopes = [root];
    scopes.forEach(function (scope) {
      var candidates = scope.querySelectorAll
        ? scope.querySelectorAll('a,button,[role="menuitem"]')
        : [];
      candidates.forEach(function (el) {
        if (el.getAttribute && el.getAttribute('data-lp-hidden') === '1') return;
        var label = (el.textContent || '').trim();
        var href  = (el.getAttribute && el.getAttribute('href')) || '';
        var match = HIDDEN_TABS.some(function (t) {
          return (
            href === t.path ||
            href.indexOf(t.path + '/') === 0 ||
            href.indexOf(t.path + '?') === 0 ||
            label.toLowerCase() === t.label.toLowerCase()
          );
        });
        if (!match) return;
        // Hide the closest list-item or menu-item wrapper if there is one,
        // otherwise hide the element itself. Keeps dividers/badges from
        // being left behind.
        var wrap = (el.closest && el.closest('li,[role="menuitem"],[role="none"]')) || el;
        if (wrap.style) wrap.style.setProperty('display', 'none', 'important');
        if (wrap.setAttribute) wrap.setAttribute('data-lp-hidden', '1');
      });
    });
  }

  // Selectors that target Graylog logos on Open 6.x. We err on the side of
  // matching too much (any SVG whose id contains "logo", plus a couple of
  // known className patterns); the replace function still validates each hit.
  var LOGO_SELECTORS = [
    'svg#logoTitleId',
    'svg[id*="logo" i]',
    'a[href="/"] svg',                         // top-left brand link
    '[class*="navbar" i] svg[role="img"]',
    '[class*="LoginBox" i] svg',
    '[class*="LoginPage" i] svg'
  ];

  function fetchLpSvg() {
    if (lpSvgInlineCache) return Promise.resolve(lpSvgInlineCache);
    return fetch(LP_SVG_URL, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (text) {
        // Strip any XML prolog so it's safe to inject inline.
        text = text.replace(/<\?xml[^?]*\?>\s*/i, '');
        lpSvgInlineCache = text;
        return text;
      });
  }

  function alreadyReplaced(node) {
    return node && node.getAttribute && node.getAttribute('data-lp-branded') === '1';
  }

  function replaceNode(node, lpSvgText) {
    if (alreadyReplaced(node)) return;
    var width  = node.getAttribute('width')  || node.clientWidth  || '';
    var height = node.getAttribute('height') || node.clientHeight || '';
    var className = node.getAttribute('class') || '';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = lpSvgText.trim();
    var svg = wrapper.firstElementChild;
    if (!svg || svg.tagName.toLowerCase() !== 'svg') return;

    if (width)  svg.setAttribute('width',  width);
    if (height) svg.setAttribute('height', height);
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('data-lp-branded', '1');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    node.replaceWith(svg);
  }

  function scan(root, lpSvgText) {
    if (!root || !root.querySelectorAll) return;
    LOGO_SELECTORS.forEach(function (sel) {
      var nodes;
      try { nodes = root.querySelectorAll(sel); } catch (e) { return; }
      nodes.forEach(function (n) {
        // Skip replacements outside the page chrome (e.g. tiny inline icons).
        if (n.tagName.toLowerCase() !== 'svg') return;
        replaceNode(n, lpSvgText);
      });
    });
    // Every DOM mutation pass is also a chance to drop the suppressed tabs.
    hideTabs(root);
  }

  function start() {
    // CSS can hide the suppressed tabs even before the SVG fetch resolves,
    // so run it first and make it independent of the logo-swap path.
    injectHideCss();
    hideTabs(document);

    fetchLpSvg().then(function (lpSvgText) {
      scan(document, lpSvgText);
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1) scan(n, lpSvgText);
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }).catch(function (e) {
      // Failures are non-fatal — just log so devs can tell what went wrong.
      console.warn('[lp-branding] failed to load LP svg:', e);
      // Even if the logo swap can't run, keep the tab-hiding observer alive
      // so Security/Enterprise stay gone on navigation.
      var obs = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n && n.nodeType === 1) hideTabs(n);
          }
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
