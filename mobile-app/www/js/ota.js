// Over-the-air web-bundle updates. Modeled on Ionic Appflow Live Updates:
// the native shell stays the same, but the HTML/JS/CSS shipped in the APK
// can be replaced by a newer bundle downloaded at runtime. Native plugin
// or config.xml changes still require a real APK release.
//
// Boot sequence (see index.html for load order):
//   1. cordova.js, Highcharts CDN, preload.js, version.js run first.
//   2. ota.js runs and SYNCHRONOUSLY decides which source to load the app
//      from: the active OTA bundle (in cordova.file.dataDirectory) or the
//      APK's bundled www/. The decision is based on metadata in
//      localStorage['ota.active.v1'] and a session-scoped skip flag set
//      when a previous boot crashed.
//   3. ota.js dispatches the app load. For the APK path, it injects normal
//      <script src="js/..."> tags (resolved by the Cordova WebView's asset
//      loader). For the OTA path, it reads each file as text via
//      cordova-plugin-file and evaluates it in the page, then injects CSS
//      as <style> elements.
//   4. After app.js finishes init() it sets window.__OTA_INIT_DONE__ and
//      calls OTA.checkForUpdate(), which contacts the manifest URL in the
//      background to fetch + stage the next bundle.
//
// Why eval instead of `window.location.replace('file:///.../index.html')`?
//   cordova-android 15 serves the WebView from https://localhost/ via
//   WebViewAssetLoader. A file:// redirect would put us in a different
//   origin (or worse, break the Cordova bridge). Reading the file contents
//   via the plugin and evaluating them in the existing page keeps the
//   bridge alive and avoids cross-origin headaches.
//
// Preserving per-build state:
//   The OTA bundle does NOT contain js/preload.js -- that file is the
//   per-APK seed (Graylog URL/token, scope) written by
//   scripts/build-preloaded.js and must survive an OTA update. preload.js
//   loads from the APK shell before ota.js runs, so it always wins
//   regardless of which source provides the rest of the app.
(function () {
  'use strict';

  // -----------------------------------------------------------------
  // Constants. The manifest + bundle zips are served from the repo
  // root via GitHub Pages on easierbycode.com, same host as app.apk
  // (see build-apk-preloaded.yml and the README).
  // -----------------------------------------------------------------
  var MANIFEST_URL  = 'https://easierbycode.com/tok-scrape/manifest.json';
  var META_KEY      = 'ota.active.v1';
  var NATIVE_SEEN_KEY = 'ota.native.seen.v1';     // last baked __BUNDLE_VERSION__ we booted;
                                                  // a change means a new APK was installed.
  var SKIP_FLAG     = 'ota.skip';
  var BAD_BOOT_KEY  = 'ota.boot.pending';        // sessionStorage; set during boot,
                                                  // cleared once init succeeds; if it's
                                                  // still set on the next boot, the
                                                  // previous one crashed.
  var INIT_TIMEOUT_MS = 12000;                    // if app init doesn't complete in this
                                                  // window, treat the OTA bundle as bad
                                                  // and reload from the APK shell.

  // App scripts/styles loaded dynamically by ota.js (rather than via static
  // <script>/<link> tags in index.html). New files added here require an
  // APK rebuild AND a matching minNativeVersion bump in the manifest.
  var APP_CSS = ['css/app.css', 'css/virals.css'];
  var APP_JS  = [
    'js/users.js',
    'js/api.js',
    'js/xlsx.js',
    'js/charts.js',
    'js/app.js',
    'js/virals.js',
  ];

  // -----------------------------------------------------------------
  // Synchronous boot decision. Runs as soon as ota.js parses.
  // -----------------------------------------------------------------
  var bundleVersion = String(window.__BUNDLE_VERSION__ || 'dev');
  var nativeVersion = String(window.__APK_NATIVE_VERSION__ || '0.0.0');

  var skipOTA = false;
  try { skipOTA = sessionStorage.getItem(SKIP_FLAG) === '1'; } catch (_) {}

  // Persistent "previous boot didn't complete" detection. localStorage
  // (not sessionStorage) so an outright crash that kills the process is
  // still caught on the next launch.
  var previousBootHung = false;
  try { previousBootHung = localStorage.getItem(BAD_BOOT_KEY) === '1'; } catch (_) {}

  var meta = null;
  try {
    var raw = localStorage.getItem(META_KEY);
    if (raw) meta = JSON.parse(raw);
  } catch (_) { meta = null; }

  function semverCompare(a, b) {
    // Lenient compare: numeric segment-wise where possible, lexical fallback.
    // Strings like git short SHAs fall back to lexical and always "differ".
    var pa = String(a || '').split('.');
    var pb = String(b || '').split('.');
    var n = Math.max(pa.length, pb.length);
    for (var i = 0; i < n; i++) {
      var na = parseInt(pa[i], 10);
      var nb = parseInt(pb[i], 10);
      var bothNum = !isNaN(na) && !isNaN(nb);
      if (bothNum) {
        if (na !== nb) return na - nb;
      } else {
        var sa = pa[i] || '';
        var sb = pb[i] || '';
        if (sa !== sb) return sa < sb ? -1 : 1;
      }
    }
    return 0;
  }

  function metaIsUsable(m) {
    if (!m || !m.healthy || !m.version || !m.activeDir) return false;
    // Native gate.
    if (m.minNativeVersion && semverCompare(nativeVersion, m.minNativeVersion) < 0) return false;
    // Only use OTA if it actually differs from what's baked in. We compare
    // SHAs (git short shas) as strings; equal means the APK already has it.
    if (m.version === bundleVersion) return false;
    return true;
  }

  // Native-binary update detection. The APK bakes its own www -- version.js
  // stamps __BUNDLE_VERSION__ with the build's git sha -- so a freshly
  // installed APK carries web assets at least as new as anything a PRIOR
  // APK could have OTA-downloaded. But cordova-plugin-file app data (incl.
  // the active OTA bundle in dataDirectory/bundles/active) survives an APK
  // upgrade. Without this guard, an OLDER staged bundle keeps masking the
  // newer baked www -- e.g. a pre-"Combine" bundle hiding the Combine
  // button that shipped in the new APK -- because metaIsUsable() only
  // checks that versions DIFFER, not which is newer (git shas aren't
  // orderable, so "newer" can't be inferred by comparison).
  //
  // Mirrors Ionic Appflow / Capacitor live-update semantics: a native
  // update resets the live-update baseline to the bundled web. We remember
  // the baked bundleVersion we last booted; if it changed (a new APK), drop
  // the active OTA pointer so the APK's www wins this boot. checkForUpdate()
  // can then re-stage a genuinely newer bundle on top.
  var lastNative = null;
  try { lastNative = localStorage.getItem(NATIVE_SEEN_KEY); } catch (_) {}
  if (lastNative !== bundleVersion) {
    if (meta) {
      console.log('OTA: native bundle changed (' + lastNative + ' -> ' +
                  bundleVersion + ') -- resetting to bundled www, dropping ' +
                  meta.version);
      meta = null;
      try { localStorage.removeItem(META_KEY); } catch (_) {}
    }
    // A new APK shouldn't inherit a previous install's boot-hung flag.
    previousBootHung = false;
    try { localStorage.removeItem(BAD_BOOT_KEY); } catch (_) {}
    try { localStorage.setItem(NATIVE_SEEN_KEY, bundleVersion); } catch (_) {}
  }

  var useOTA = !skipOTA && !previousBootHung && metaIsUsable(meta);

  // If a previous boot hung, fall back to APK shell and discard the bad bundle.
  if (previousBootHung && meta) {
    meta.healthy = false;
    meta.lastError = 'boot-hung';
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {}
  }
  // Mark THIS boot pending only if we're actually about to boot from OTA --
  // an APK-shell hang shouldn't invalidate a healthy staged bundle.
  if (useOTA) {
    try { localStorage.setItem(BAD_BOOT_KEY, '1'); } catch (_) {}
  } else {
    try { localStorage.removeItem(BAD_BOOT_KEY); } catch (_) {}
  }

  // Expose a tiny diagnostic so adb logcat | grep OTA captures the decision.
  console.log('OTA: boot useOTA=' + useOTA +
              ' bundleVersion=' + bundleVersion +
              ' activeVersion=' + (meta && meta.version) +
              ' nativeVersion=' + nativeVersion +
              ' previousBootHung=' + previousBootHung +
              ' skipOTA=' + skipOTA);

  // -----------------------------------------------------------------
  // Loaders.
  // -----------------------------------------------------------------
  function injectScriptSrc(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload  = function () { resolve(); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function injectInlineScript(text, label) {
    // new Function() runs in the global scope but doesn't trip CSP's
    // 'unsafe-eval' restriction in older Cordova builds. Our CSP already
    // allows 'unsafe-eval' (see index.html), so a direct (0,eval)(text)
    // also works; prefer the indirect eval so a //# sourceURL comment
    // attaches a sensible name in DevTools.
    var src = text + '\n//# sourceURL=ota://' + label;
    (0, eval)(src);                                                // eslint-disable-line no-eval
  }

  function injectInlineStyle(text, label) {
    var style = document.createElement('style');
    style.setAttribute('data-ota-source', label);
    style.textContent = text;
    document.head.appendChild(style);
  }

  function injectLinkHref(href) {
    var link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  // Read a file as text via cordova-plugin-file. The caller passes a full
  // URL (cordova.file.dataDirectory + 'bundles/active/<path>').
  function readTextFile(url) {
    return new Promise(function (resolve, reject) {
      window.resolveLocalFileSystemURL(url, function (entry) {
        entry.file(function (file) {
          var r = new FileReader();
          r.onloadend = function () { resolve(this.result); };
          r.onerror   = function (e) { reject(e); };
          r.readAsText(file);
        }, reject);
      }, reject);
    });
  }

  function readBinaryFile(url) {
    return new Promise(function (resolve, reject) {
      window.resolveLocalFileSystemURL(url, function (entry) {
        entry.file(function (file) {
          var r = new FileReader();
          r.onloadend = function () { resolve(this.result); };
          r.onerror   = function (e) { reject(e); };
          r.readAsArrayBuffer(file);
        }, reject);
      }, reject);
    });
  }

  // -----------------------------------------------------------------
  // App-load orchestration.
  // -----------------------------------------------------------------
  function loadAppFromAPK() {
    // Sequential <script> injection so app.js can rely on users.js being
    // defined by the time it runs (matches the original index.html order).
    var p = Promise.resolve();
    APP_CSS.forEach(function (path) {
      injectLinkHref(path);
    });
    APP_JS.forEach(function (path) {
      p = p.then(function () { return injectScriptSrc(path); });
    });
    return p;
  }

  function loadAppFromOTA(activeDir) {
    // Read every CSS/JS file out of cordova.file.dataDirectory/bundles/active
    // and inject inline. Sequential JS to preserve order.
    var p = Promise.resolve();
    APP_CSS.forEach(function (path) {
      p = p.then(function () {
        return readTextFile(activeDir + path).then(function (text) {
          injectInlineStyle(text, 'ota:' + path);
        });
      });
    });
    APP_JS.forEach(function (path) {
      p = p.then(function () {
        return readTextFile(activeDir + path).then(function (text) {
          injectInlineScript(text, path);
        });
      });
    });
    return p;
  }

  function markBadAndReload(reason) {
    console.warn('OTA: marking bundle bad (' + reason + ') and reloading');
    try { sessionStorage.setItem(SKIP_FLAG, '1'); } catch (_) {}
    if (meta) {
      meta.healthy = false;
      meta.lastError = String(reason);
      try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (_) {}
    }
    // Drop the boot-pending flag so the recovery reload isn't itself
    // mistaken for another hung boot.
    try { localStorage.removeItem(BAD_BOOT_KEY); } catch (_) {}
    window.location.reload();
  }

  // Whichever path we pick, wait for the global error handler to detect a
  // crash during boot. If the OTA bundle is broken, flip the skip flag and
  // reload back to the APK shell.
  window.addEventListener('error', function (e) {
    if (!useOTA) return;
    if (window.__OTA_INIT_DONE__) return;       // post-init errors are app bugs, not OTA
    markBadAndReload(e && (e.message || 'error event'));
  });

  // Failsafe: if init never completes (silent hang), recover.
  var initTimer = setTimeout(function () {
    if (window.__OTA_INIT_DONE__) return;
    if (!useOTA) return;                         // APK is the source of truth; nothing to fall back to
    markBadAndReload('init timeout');
  }, INIT_TIMEOUT_MS);

  // The Cordova plugins (including cordova-plugin-file) aren't ready until
  // 'deviceready' fires. APK-only path doesn't need them; OTA path does.
  function whenDeviceReady() {
    return new Promise(function (resolve) {
      if (window.cordova && document.readyState !== 'loading') {
        // Already past 'deviceready'? cordova has no idempotent check, so
        // listen and also resolve on a microtask to cover both cases.
        document.addEventListener('deviceready', resolve, { once: true });
        // Most boots ota.js parses BEFORE deviceready, so this is fine.
      } else {
        document.addEventListener('deviceready', resolve, { once: true });
      }
    });
  }

  function clearBootHungOnSuccess() {
    // Once the app announces init done, clear the boot-pending flag so the
    // next launch doesn't think this one crashed.
    var t = setInterval(function () {
      if (window.__OTA_INIT_DONE__) {
        clearInterval(t);
        clearTimeout(initTimer);
        try { localStorage.removeItem(BAD_BOOT_KEY); } catch (_) {}
        console.log('OTA: init complete');
      }
    }, 200);
  }
  clearBootHungOnSuccess();

  // Kick off the load.
  var bootPromise;
  if (useOTA) {
    bootPromise = whenDeviceReady().then(function () {
      return loadAppFromOTA(meta.activeDir);
    });
  } else {
    bootPromise = loadAppFromAPK();
  }
  bootPromise.catch(function (err) {
    console.error('OTA: app load failed:', err && err.message || err);
    if (useOTA) markBadAndReload('load: ' + (err && err.message || err));
  });

  // -----------------------------------------------------------------
  // Background update check + download. Called by app.js after init.
  // -----------------------------------------------------------------
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return injectScriptSrc('vendor/jszip.min.js').then(function () { return window.JSZip; });
  }

  function sha256Hex(buf) {
    return crypto.subtle.digest('SHA-256', buf).then(function (hash) {
      var bytes = new Uint8Array(hash);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i].toString(16);
        hex += b.length === 1 ? '0' + b : b;
      }
      return hex;
    });
  }

  // cordova-plugin-file directory helpers. All take and resolve to
  // DirectoryEntry instances under cordova.file.dataDirectory.
  function getRootDir() {
    return new Promise(function (resolve, reject) {
      window.resolveLocalFileSystemURL(cordova.file.dataDirectory, resolve, reject);
    });
  }
  function getOrCreateDir(parent, name) {
    return new Promise(function (resolve, reject) {
      parent.getDirectory(name, { create: true, exclusive: false }, resolve, reject);
    });
  }
  function removeDirIfExists(parent, name) {
    return new Promise(function (resolve) {
      parent.getDirectory(name, { create: false }, function (dir) {
        dir.removeRecursively(function () { resolve(); }, function () { resolve(); });
      }, function () { resolve(); });
    });
  }
  function writeFileInDir(dir, name, blob) {
    return new Promise(function (resolve, reject) {
      dir.getFile(name, { create: true, exclusive: false }, function (fileEntry) {
        fileEntry.createWriter(function (writer) {
          writer.onwriteend = function () { resolve(fileEntry); };
          writer.onerror    = reject;
          writer.write(blob);
        }, reject);
      }, reject);
    });
  }

  // Extract a JSZip archive into a target directory recursively.
  function extractZipInto(zip, targetDir) {
    var entries = [];
    zip.forEach(function (relPath, zipEntry) {
      if (zipEntry.dir) return;
      entries.push({ relPath: relPath, entry: zipEntry });
    });
    // Serial extract so we never overwhelm WebView IO. The bundle is small.
    var p = Promise.resolve();
    entries.forEach(function (item) {
      p = p.then(function () {
        return item.entry.async('uint8array').then(function (bytes) {
          // Drop the leading "www/" prefix if the zip wraps files under www/.
          // The CI workflow zips the www/ directory contents directly, so
          // paths are already "js/app.js" etc -- this is defensive.
          var rel = item.relPath.replace(/^www\//, '');
          var segments = rel.split('/');
          var fileName = segments.pop();
          if (!fileName) return null;                                 // ignore stray dir entries
          if (fileName === 'preload.js' && segments.join('/') === 'js') return null;
          var dirChain = Promise.resolve(targetDir);
          segments.forEach(function (seg) {
            dirChain = dirChain.then(function (d) { return getOrCreateDir(d, seg); });
          });
          return dirChain.then(function (dir) {
            return writeFileInDir(dir, fileName, new Blob([bytes]));
          });
        });
      });
    });
    return p;
  }

  function checkForUpdate(opts) {
    opts = opts || {};
    var url = (opts.manifestUrl || MANIFEST_URL) + '?ts=' + Date.now();
    console.log('OTA: checking', url);
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('manifest HTTP ' + r.status);
      return r.json();
    }).then(function (manifest) {
      if (!manifest || !manifest.version || !manifest.bundleUrl || !manifest.sha256) {
        throw new Error('manifest missing required fields');
      }
      // Native gate.
      if (manifest.minNativeVersion && semverCompare(nativeVersion, manifest.minNativeVersion) < 0) {
        console.warn('OTA: native too old (' + nativeVersion +
                     ' < ' + manifest.minNativeVersion + '), refusing ' + manifest.version);
        return { skipped: 'native-too-old', manifest: manifest };
      }
      // Already running it?
      var runningVersion = (useOTA && meta) ? meta.version : bundleVersion;
      if (manifest.version === runningVersion) {
        console.log('OTA: up to date (' + runningVersion + ')');
        return { skipped: 'current', manifest: manifest };
      }
      // Already staged for next boot?
      if (meta && meta.version === manifest.version && meta.healthy) {
        console.log('OTA: ' + manifest.version + ' already staged');
        return { skipped: 'already-staged', manifest: manifest };
      }
      console.log('OTA: downloading ' + manifest.version + ' from ' + manifest.bundleUrl);
      return fetch(manifest.bundleUrl, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('bundle HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        return sha256Hex(buf).then(function (got) {
          if (got.toLowerCase() !== String(manifest.sha256).toLowerCase()) {
            throw new Error('sha256 mismatch: got ' + got + ' expected ' + manifest.sha256);
          }
          return buf;
        });
      }).then(function (buf) {
        return loadJSZip().then(function (JSZip) {
          return JSZip.loadAsync(buf);
        }).then(function (zip) {
          return getRootDir().then(function (root) {
            // Clean any previous staging dir, then extract fresh.
            return removeDirIfExists(root, 'bundles-staging').then(function () {
              return getOrCreateDir(root, 'bundles-staging');
            }).then(function (stagingRoot) {
              return getOrCreateDir(stagingRoot, manifest.version).then(function (target) {
                return extractZipInto(zip, target).then(function () {
                  // Atomic-ish activation: swap "bundles/active" to the new tree.
                  return getOrCreateDir(root, 'bundles').then(function (bundlesDir) {
                    return removeDirIfExists(bundlesDir, 'active').then(function () {
                      return new Promise(function (resolve, reject) {
                        target.moveTo(bundlesDir, 'active', resolve, reject);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      }).then(function (newActive) {
        var activeDir = cordova.file.dataDirectory + 'bundles/active/';
        var newMeta = {
          version: manifest.version,
          bundleUrl: manifest.bundleUrl,
          sha256: manifest.sha256,
          minNativeVersion: manifest.minNativeVersion || '0.0.0',
          activeDir: activeDir,
          stagedAt: new Date().toISOString(),
          healthy: true,
          lastError: null,
        };
        try { localStorage.setItem(META_KEY, JSON.stringify(newMeta)); } catch (_) {}
        console.log('OTA: staged ' + manifest.version + ' -- active on next launch');
        return { applied: 'next-launch', manifest: manifest };
      });
    }).catch(function (err) {
      console.warn('OTA: check failed:', err && err.message || err);
      return { error: String(err && err.message || err) };
    });
  }

  function resetToBundled() {
    try { localStorage.removeItem(META_KEY); } catch (_) {}
    try { sessionStorage.setItem(SKIP_FLAG, '1'); } catch (_) {}
    console.log('OTA: reset to bundled -- reload to take effect');
  }

  window.OTA = {
    checkForUpdate: checkForUpdate,
    resetToBundled: resetToBundled,
    _meta: function () { return meta; },
    _useOTA: function () { return useOTA; },
    _bundleVersion: bundleVersion,
    _nativeVersion: nativeVersion,
  };
})();
