/*
 * cordova.js — web / desktop-binary shim for the LP mobile demo.
 *
 * The *real* cordova.js is injected by the native platform during
 * `cordova prepare` (see .github/workflows/build-demo-apk.yml), so it only
 * exists inside the built APK. On GitHub Pages — and therefore inside Thirsty
 * OS (whether the web deployment or the compiled desktop binary), which loads
 * this app at easierbycode.com/tok-scrape/mobile-demo/www/ — the file is a 404.
 * Without it `<script src="cordova.js">` loads nothing: `deviceready` never
 * fires and `cordova.InAppBrowser` is undefined, so js/index.js never runs and
 * the demo sits forever on "Launching browser…".
 *
 * This file is the missing cordova.js for those non-native runtimes. It
 * emulates exactly the surface js/index.js + js/guest-bridge.js depend on:
 *   • the `deviceready` document event
 *   • cordova.InAppBrowser.open(url, target, opts) → a browser ref exposing
 *     addEventListener('loadstart'|'loadstop'|'loaderror'|'message'|'exit'),
 *     executeScript({code|file}, cb), insertCSS(), show()/hide()/close().
 *
 * It is NOT meant to ship inside the APK: `cordova prepare` overwrites
 * www/cordova.js with the platform's real bridge, so on-device the native
 * implementation wins. The guard below is belt-and-suspenders — it makes this
 * shim a no-op if a native Cordova bridge is somehow already present.
 *
 * Why an <iframe> works for InAppBrowser here
 * -------------------------------------------
 * executeScript() injects arbitrary JS into the opened page. A plain <iframe>
 * can only do that (contentWindow.eval) when it is *same-origin* with the host.
 * The demo opens fixtures/orders.html, which lives on the SAME origin as this
 * app (both under easierbycode.com/tok-scrape/…), so the iframe approach works
 * — even when Thirsty OS embeds this whole app in a cross-origin, sandboxed
 * frame, because inside that frame the app is still served from its own origin
 * and its child orders.html iframe shares it. orders.html ships no CSP, so the
 * injected eval is allowed.
 */
(function () {
  "use strict";

  // --- Don't fight a real Cordova, and don't install twice. -----------------
  if (window._cordovaNative) return; // Android native JS bridge present
  // A real framework (or a prior install of this shim) already owns
  // cordova.require — never clobber it. A bare `window.cordova = {}` stub with
  // no require is harmless to extend, so it's allowed through.
  if (window.cordova && (window.cordova.require || window.cordova.__shim)) return;

  var LOG = "[cordova-shim]";

  function setStyles(el, styles) {
    for (var k in styles) if (styles.hasOwnProperty(k)) el.style[k] = styles[k];
  }

  // "location=yes,hidden=no,clearcache=yes" -> { location:"yes", hidden:"no", … }
  function parseOptions(opts) {
    var out = {};
    String(opts || "").split(",").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i === -1) return;
      out[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    });
    return out;
  }

  /* ----------------------------------------------------- InAppBrowser ref -- */

  function InAppBrowserRef(url, target, options) {
    this._listeners = {
      loadstart: [], loadstop: [], loaderror: [], message: [], exit: [],
      beforeload: [], customscheme: [],
    };
    this._opts = parseOptions(options);
    this._target = target || "_blank";
    this._url = url;
    this._closed = false;
    this._build(url);
  }

  InAppBrowserRef.prototype.addEventListener = function (type, cb) {
    if (this._listeners[type]) this._listeners[type].push(cb);
  };
  InAppBrowserRef.prototype.removeEventListener = function (type, cb) {
    var arr = this._listeners[type];
    if (!arr) return;
    var i = arr.indexOf(cb);
    if (i !== -1) arr.splice(i, 1);
  };
  InAppBrowserRef.prototype._emit = function (type, evt) {
    evt = evt || {};
    evt.type = type;
    (this._listeners[type] || []).slice().forEach(function (cb) {
      try { cb(evt); } catch (e) { console.error(LOG, type + " listener threw", e); }
    });
  };

  InAppBrowserRef.prototype._build = function (url) {
    var self = this;
    var hidden = this._opts.hidden === "yes";
    var showBar = this._opts.location !== "no"; // default: show the location bar

    var hostEl = document.createElement("div");
    hostEl.className = "__cdvShimIab";
    setStyles(hostEl, {
      position: "fixed", top: "0", left: "0", right: "0", bottom: "0",
      display: hidden ? "none" : "flex", flexDirection: "column",
      background: "#0b0d11", zIndex: "2147483000",
    });

    if (showBar) {
      var bar = document.createElement("div");
      setStyles(bar, {
        flex: "0 0 44px", display: "flex", alignItems: "center", gap: "8px",
        padding: "0 8px 0 12px", background: "#13161c", color: "#aeb6c2",
        font: "13px/1.2 system-ui, -apple-system, sans-serif",
        borderBottom: "1px solid #222833",
      });
      var label = document.createElement("span");
      setStyles(label, { flex: "1 1 auto", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" });
      label.textContent = url;
      var close = document.createElement("button");
      close.type = "button";
      close.textContent = "✕";
      close.setAttribute("aria-label", "Close");
      setStyles(close, {
        flex: "0 0 auto", background: "transparent", border: "0", color: "#f5f7f9",
        fontSize: "18px", lineHeight: "1", cursor: "pointer", padding: "6px 8px",
      });
      close.addEventListener("click", function () { self.close(); });
      bar.appendChild(label);
      bar.appendChild(close);
      hostEl.appendChild(bar);
      this._barLabel = label;
    }

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "InAppBrowser");
    setStyles(iframe, { flex: "1 1 auto", width: "100%", height: "100%", border: "0", background: "#fff" });
    // No `sandbox` attribute on purpose: standalone the frame stays unrestricted;
    // embedded in Thirsty OS it inherits the parent frame's sandbox flags
    // (allow-scripts + allow-same-origin), which is exactly what executeScript
    // and the same-origin message channel below require.
    iframe.addEventListener("load", function () { self._onFrameLoad(); });
    iframe.addEventListener("error", function () {
      self._emit("loaderror", { url: self._url, code: -1, message: "iframe load error" });
    });
    hostEl.appendChild(iframe);

    (document.body || document.documentElement).appendChild(hostEl);
    this.hostEl = hostEl;
    this.iframe = iframe;

    // Defer loadstart so listeners attached right after open() returns still
    // receive it (native fires it asynchronously too). It's queued before the
    // iframe's load task, so it always precedes the first loadstop.
    setTimeout(function () { if (!self._closed) self._emit("loadstart", { url: url }); }, 0);
    iframe.src = url;
  };

  // Fires on every (same-origin) navigation of the frame, including the
  // self-redirects index.js triggers via executeScript("location.href = …").
  InAppBrowserRef.prototype._onFrameLoad = function () {
    if (this._closed) return;
    var self = this;
    var win = this.iframe.contentWindow;
    var href = this._url;
    try { href = win.location.href; } catch (e) { /* cross-origin: keep last known url */ }
    this._url = href;

    // Inject the guest→host channel the native IAB normally provides. guest-
    // bridge.js posts via window.cordova_iab.postMessage; route that to our
    // 'message' listeners. Re-injected per navigation (each is a fresh document).
    try {
      win.cordova_iab = { postMessage: function (s) { self._onGuestMessage(s); } };
    } catch (e) { /* cross-origin guest: messaging unavailable */ }

    if (this._barLabel) this._barLabel.textContent = href;
    this._emit("loadstop", { url: href });
  };

  InAppBrowserRef.prototype._onGuestMessage = function (raw) {
    var data = raw;
    if (typeof raw === "string") { try { data = JSON.parse(raw); } catch (e) { data = raw; } }
    // Native delivers event.data already parsed; index.js also tolerates strings.
    this._emit("message", { data: data });
  };

  InAppBrowserRef.prototype.executeScript = function (details, cb) {
    var self = this;
    var run = function (code) {
      if (self._closed) return; // browser was closed before this (async) injection ran
      var result;
      try {
        var win = self.iframe && self.iframe.contentWindow;
        // Indirect eval on the guest window → runs `code` in the guest's global
        // scope (orders.html, same origin, no CSP), mirroring native injection.
        result = win ? win.eval(code) : undefined;
      } catch (e) {
        console.error(LOG, "executeScript failed", e);
      }
      if (cb) { try { cb([result]); } catch (e) { /* caller's problem */ } }
    };
    if (details && details.code != null) {
      run(String(details.code));
    } else if (details && details.file) {
      fetch(details.file)
        .then(function (r) { return r.text(); })
        .then(run)
        .catch(function (e) { console.error(LOG, "executeScript file fetch failed", e); if (cb) cb([]); });
    } else if (cb) {
      cb([]);
    }
  };

  InAppBrowserRef.prototype.insertCSS = function (details, cb) {
    try {
      var doc = this.iframe.contentWindow.document;
      var css = details && details.code != null ? String(details.code) : "";
      if (css) {
        var style = doc.createElement("style");
        style.textContent = css;
        (doc.head || doc.documentElement).appendChild(style);
      }
    } catch (e) { console.error(LOG, "insertCSS failed", e); }
    if (cb) cb();
  };

  InAppBrowserRef.prototype.show = function () { if (this.hostEl) this.hostEl.style.display = "flex"; };
  InAppBrowserRef.prototype.hide = function () { if (this.hostEl) this.hostEl.style.display = "none"; };
  InAppBrowserRef.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    if (this.hostEl && this.hostEl.parentNode) this.hostEl.parentNode.removeChild(this.hostEl);
    this._emit("exit", { type: "exit" });
  };

  /* --------------------------------------------------------- cordova api -- */

  var InAppBrowser = {
    open: function (url, target, options) {
      if (target === "_system") {
        // External browser. Inside Thirsty OS the sandbox blocks popups, but the
        // demo only ever opens with _blank, so this is just for completeness.
        try { window.open(url, "_blank"); } catch (e) { /* blocked */ }
        return null;
      }
      return new InAppBrowserRef(url, target, options);
    },
  };

  var cordova = window.cordova || {};
  cordova.__shim = true;
  cordova.platformId = "browser";
  cordova.version = "shim-1.0.0";
  cordova.InAppBrowser = InAppBrowser;
  if (typeof cordova.require !== "function") cordova.require = function () { return undefined; };
  window.cordova = cordova;

  /* --------------------------------------------------------- deviceready -- */
  // index.js subscribes synchronously (it runs right after this file), so a
  // single dispatch once the DOM is ready reaches it. setTimeout(0) lets any
  // remaining top-level scripts finish registering first.
  function fireDeviceReady() {
    if (window.__cdvShimDeviceReady) return;
    window.__cdvShimDeviceReady = true;
    var ev;
    try {
      ev = new Event("deviceready");
    } catch (e) {
      ev = document.createEvent("Event");
      ev.initEvent("deviceready", false, false);
    }
    document.dispatchEvent(ev);
    console.log(LOG, "deviceready dispatched (browser shim, platform=" + cordova.platformId + ")");
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(fireDeviceReady, 0); });
  } else {
    setTimeout(fireDeviceReady, 0);
  }

  console.log(LOG, "installed");
})();
