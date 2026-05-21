// Bundle + native version metadata, stamped at build time by
// scripts/stamp-bundle-version.js (run as a Cordova `before_prepare` hook).
//
//   __BUNDLE_VERSION__       Short git SHA (or BUNDLE_VERSION env override)
//                            identifying the www/ contents shipped in this
//                            APK. Compared against the remote OTA manifest
//                            to decide whether a downloaded bundle is newer.
//   __APK_NATIVE_VERSION__   Reads from the <widget version="..."> in
//                            config.xml. An OTA bundle declaring a higher
//                            minNativeVersion than this is refused so old
//                            APKs don't load bundles needing native plugins
//                            they don't have.
//   __BUNDLE_STAMPED_AT__    ISO timestamp the stamp ran. Diagnostics only.
//
// This file is overwritten on every build. The committed contents are a
// no-op stub; running `npm run build` (or anything else that triggers
// `cordova prepare`) replaces them with real values.
window.__BUNDLE_VERSION__     = 'dev';
window.__APK_NATIVE_VERSION__ = '0.0.0';
window.__BUNDLE_STAMPED_AT__  = '';
