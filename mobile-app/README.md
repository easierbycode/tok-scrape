# TokScrape Dashboard (Cordova Android + iOS)

A small Cordova app (Android + iOS) that visualizes TikTok Shop scrape data ingested into a Graylog instance. The dashboard pulls messages via Graylog's Universal Search REST API, parses the `metrics_json` and `videos_json` fields the bookmarklet writes, and renders a set of Highcharts panels.

## Layout

```
mobile-app/
├── config.xml          Cordova app metadata (package id, icons, prefs, plugins)
├── package.json        Cordova CLI + cordova-android pinned (latest)
└── www/
    ├── index.html      Single-page shell (top bar + grid of cards + modals)
    ├── css/app.css     Dark theme
    └── js/
        ├── users.js    Scaffolded user roster + role-based auth helpers
        ├── api.js      GraylogClient (Basic auth: token:token, Universal Search)
        ├── charts.js   Highcharts theme + renderers
        └── app.js      Auth, settings, refresh, Active Campaigns card, error handling
```

## Active Campaigns card

The home dashboard renders an **Active Campaigns** card at the top —
brand name, post-progress bar, deadline chip, "View all" link. Until
the campaign API is wired up the list is populated from a small mock
dataset baked into `www/js/app.js` (`MOCK_CAMPAIGNS`).

The card is injected by `renderActiveCampaigns()` so it ships via the
OTA bundle even on APKs whose bundled `index.html` predates the
feature (`ota.js` only swaps CSS+JS, not HTML).

## Users & roles

The app has a client-side user roster in `www/js/users.js`. There's no real
auth here — the app uses a single Graylog API token (stored in Settings) and
the roster just drives which data a user can see and which menu items show.

The default roster is:

| Role    | Name                | Creator filter (Graylog field) |
| ------- | ------------------- | ------------------------------ |
| admin   | Daniel              | *(none — aggregate view)*      |
| member  | Wizard of Dealz     | `@wizardofdealz`               |
| member  | Beauty by Bri       | `@beautybybri`                 |
| member  | Tech Guru AK        | `@techguruak`                  |
| member  | Fitness with Mia    | `@fitnesswithmia`              |
| member  | Cooking with Kenji  | `@cookingwithkenji`            |

### What each role sees

- **Members** see only their own data. The Graylog query automatically
  appends `AND creator:"<their-handle>"`.
- **Admins** see every scrape across every creator by default. The user menu
  in the top-right adds two admin-only options:
  - **Admin dashboard** — returns to the aggregate view (clears any
    impersonation).
  - **Login As…** — pick a member; the dashboard is scoped to their
    creator handle. An orange banner across the top announces the
    impersonation and offers a "Return to Admin" button. The admin's real
    identity is preserved (stored separately from the view-as state).

### Editing the roster

Add/remove creators by editing the `USERS` array in `www/js/users.js` and
keeping the parallel `MEMBERS` list in `scripts/seed-graylog.py` (at the repo
root) in sync if you also want synthetic data for them.

## Seeding demo data

Before real bookmarklet traffic exists, you can populate Graylog with
synthetic scrapes for every scaffolded member so the dashboard has something
to show:

```bash
# From the repo root. Requires a running Graylog with a GELF HTTP input on
# port 12202 (the one docker-compose.yml sets up).
python3 scripts/seed-graylog.py                     # 14 days x 12 videos/day for each member
python3 scripts/seed-graylog.py --days 30           # deeper history
python3 scripts/seed-graylog.py --creator @beautybybri  # one member only
python3 scripts/seed-graylog.py --dry-run           # print a sample payload, don't POST
```

The seeder uses a deterministic RNG seed so re-runs produce similar shapes.
Each member gets niche-appropriate video titles and plausible GMV / Items /
Views distributions that drift day-to-day.

## Local build

### Android

Requirements: Node 20+, JDK 17, Android SDK with `cmdline-tools;latest`, `platform-tools`, `platforms;android-35` and `build-tools;35.0.0`, environment variable `ANDROID_HOME` set.

```bash
cd mobile-app
npm install -g cordova@latest
cordova platform add android@latest
npm run doctor          # optional: verify the SDK install before building
cordova build android --debug
# APK lives at: platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

The npm `build` / `build:release` / `build:preloaded` / `run` scripts each run
`scripts/check-android-sdk.js` first, so a missing SDK piece is reported with
an actionable fix instead of cordova's cryptic `apkanalyzer is not recognized`
error. Run it directly any time with `npm run doctor`.

For a quick run on a connected device or the emulator: `cordova run android`.

#### Windows setup gotchas

cordova-android 15 shells out to `apkanalyzer` (from cmdline-tools) at build
time and to `adb` (from platform-tools) at run time. A fresh Android Studio
install on Windows ships neither on PATH and frequently doesn't install the
cmdline-tools at all, which produces these errors:

```
Android SDK is missing cmdline-tools directory.
'apkanalyzer' is not recognized as an internal or external command
'adb' is not recognized as an internal or external command
```

To fix:

1. **Install the missing SDK components.** Open Android Studio -> *Settings ->
   Languages & Frameworks -> Android SDK -> SDK Tools*, check **Android SDK
   Command-line Tools (latest)** and **Android SDK Platform-Tools**, then
   Apply. (Equivalent CLI: `sdkmanager "cmdline-tools;latest" "platform-tools"
   "platforms;android-35" "build-tools;35.0.0"`.)
2. **Set `ANDROID_HOME`.** *System Properties -> Environment Variables ->
   New...*, name `ANDROID_HOME`, value `C:\Users\<you>\AppData\Local\Android\Sdk`.
3. **Add the tool dirs to `Path`.** Edit your user `Path` and add both:
   - `%ANDROID_HOME%\cmdline-tools\latest\bin`
   - `%ANDROID_HOME%\platform-tools`
4. **Open a new terminal** (PATH changes don't propagate to existing shells)
   and re-run `npm run doctor` from `mobile-app/` to verify.

### iOS

Requirements: macOS, Node 20+, Xcode 15+ with Command Line Tools (`xcode-select --install`), and CocoaPods (`sudo gem install cocoapods` or `brew install cocoapods`). `cordova-ios` 7 builds a WKWebView-only app and targets iOS 13+.

```bash
cd mobile-app
npm install -g cordova@latest
cordova platform add ios@latest
npm run build:ios       # debug build for the iOS Simulator
# .app bundle lives at: platforms/ios/build/emulator/TokScrape Dashboard.app
```

Opening `platforms/ios/build/TokScrape Dashboard.xcworkspace` in Xcode is the easiest way to add a signing team and run on a physical device. For a quick simulator launch: `npm run run:ios`.

Per-member preloaded iOS builds work the same way as Android — drop in `PLATFORM=ios`:

```bash
MEMBER_ID=wizardofdealz \
GRAYLOG_URL=http://10.0.2.2:9000 \
GRAYLOG_TOKEN=...token... \
npm run build:preloaded:ios
# -> mobile-app/dist/app-wizardofdealz.ipa            (if a signed .ipa was produced)
# -> mobile-app/dist/app-wizardofdealz.app.zip        (otherwise, the .app bundle zipped)
```

Without a configured signing team Cordova produces an unsigned `.app` bundle (run on the iOS Simulator only). To produce a distributable `.ipa`, add a `build.json` at `mobile-app/build.json` with your development team / provisioning profile (see [Cordova iOS signing docs](https://cordova.apache.org/docs/en/latest/guide/platforms/ios/index.html#signing-an-app)).

## Configure at runtime

The app launches into a settings modal on first run. Provide:

- **Graylog base URL** — the host the device can reach (e.g. `http://192.168.1.10:9000`, or your tunnel URL). `localhost` only works in the Android emulator if you also run `adb reverse tcp:9000 tcp:9000`.
- **Graylog API token** — generate under *System → Users → Edit tokens*. Sent as HTTP Basic auth where the token is the username and the literal string `token` is the password (Graylog's documented scheme).
- **Source filter** — Lucene query that selects bookmarklet messages. Defaults to `source:tiktok-bookmarklet`, matching what the bookmarklet posts. (Graylog indexes the GELF `host` field as `source`, so `source:` — not `host:` — is what matches stored messages.)

Settings are stored in the WebView's `localStorage`. To wipe them: app uninstall, or reopen the modal and clear fields.

## Graylog CORS

The app makes ordinary `fetch` calls from the WebView origin, so Graylog must allow CORS from `*` (or the WebView's origin). The repo's `docker-compose.yml` already sets:

```yaml
GRAYLOG_HTTP_ENABLE_CORS: "true"
GRAYLOG_HTTP_CORS_ALLOW_ORIGIN: "*"
```

If you're running Graylog without that, add it (or set the equivalent values in `server.conf` for a non-Docker install) and restart the Graylog container.

## CI / distribution

`.github/workflows/build-apk-preloaded.yml` builds per-member, pre-loaded debug APKs and commits them to the repo root on `main`. GitHub Pages serves the `main` branch root on the custom domain (`easierbycode.com`), same pattern as `chrome.zip`, so each APK is reachable at `https://easierbycode.com/tok-scrape/<tag>.apk` — for example the default multimember build:

> https://easierbycode.com/tok-scrape/boosteddealsdaily+2.apk

Auto-triggers on every push to `main` that touches `mobile-app/**` (or the workflow file itself) and builds the default `boosteddealsdaily,prettyplug.x,wizardofdealz` roster (filename tag `boosteddealsdaily+2`). The workflow's `paths:` filter excludes root `*.apk`, so the auto-commit that publishes the APK doesn't loop the build. Manual `workflow_dispatch` runs accept any `member_id` input:

- a single id (`wizardofdealz`) → `wizardofdealz.apk`
- a comma-separated list (`boosteddealsdaily,prettyplug.x,wizardofdealz`) → `boosteddealsdaily+2.apk`
- `all` → fans out across the matrix and publishes one APK per roster entry

Each build also uploads its APK as a workflow run artifact (named `app-<tag>`) so reviewers can grab it from the Actions UI without waiting for Pages to update.

The two required repo secrets are `GRAYLOG_URL_PROD` and `GRAYLOG_TOKEN_PROD` — the workflow passes them to `scripts/build-preloaded.js` as `GRAYLOG_URL` / `GRAYLOG_TOKEN`.

## Over-the-air web updates

The APK ships with `www/js/ota.js`, a small updater modeled on Ionic
Appflow Live Updates. The native shell stays the same, but everything
under `www/` (HTML/JS/CSS) can be replaced by a newer bundle fetched at
runtime — no Play Store / sideload roundtrip for UI or logic changes.

### What ships

- `.github/workflows/publish-web-bundle.yml` — auto-runs on every push to
  `main` that touches `mobile-app/www/**` or `mobile-app/config.xml`. It
  zips `www/` (minus `js/preload.js` and `vendor/`) into
  `bundle-<sha>.zip`, writes a `manifest.json` next to it with the
  bundle version, SHA-256, size, and `minNativeVersion`, and commits
  both to the repo root. GitHub Pages then serves them at:
  - `https://easierbycode.com/tok-scrape/manifest.json`
  - `https://easierbycode.com/tok-scrape/bundle-<sha>.zip`
- `mobile-app/www/js/ota.js` — on every launch, decides whether to load
  the app from the APK's `www/` or from a previously-downloaded OTA
  bundle in `cordova.file.dataDirectory/bundles/active/`. After the
  dashboard renders, fetches `manifest.json` in the background; if it
  advertises a new version, downloads the zip, verifies SHA-256,
  extracts to `bundles-staging/<version>/`, and atomically promotes it
  to `bundles/active/`. Used on the next launch (silent strategy).
- `mobile-app/scripts/stamp-bundle-version.js` — Cordova `before_prepare`
  / `after_prepare` hook that writes the current git SHA and the
  `<widget version>` into `www/js/version.js` so `ota.js` knows what's
  baked in.

### What's preserved across updates

- `js/preload.js` — the per-APK Graylog URL / token / scope seed
  written by `scripts/build-preloaded.js`. The OTA bundle deliberately
  excludes it, so a pre-loaded APK keeps its member identity across any
  number of OTA updates. To change a member's seed, rebuild and
  redistribute the APK.
- `vendor/jszip.min.js` — used by `ota.js` to unzip downloads. Always
  served from the APK via the WebView asset loader, so the OTA bundle
  doesn't ship a copy.

### What requires a real APK release

Anything that changes the native shell:

- A new Cordova plugin or `config.xml` preference.
- A new file under `www/` that isn't already in the `APP_JS` / `APP_CSS`
  arrays at the top of `ota.js`. (Those arrays are the load list; OTA
  bundles can change the *contents* of existing files but can't
  introduce new ones the old shell doesn't know to load.)
- Anything else where the JS would start to depend on a native API the
  old APK can't provide.

When you change any of the above, bump `<widget version="...">` in
`config.xml`. The next bundle's `manifest.json` will carry the new value
as `minNativeVersion`; older APKs will see the gate and skip the
update.

### Rollback

To unship a bad bundle, revert (or hand-edit) the latest commit on
`main` so `manifest.json` points back at a previous `bundle-<sha>.zip`.
The next launch on each device will see the older `version` field and
either ignore the bundle (if it matches what's baked into the APK) or
restage the old one.

Devices that have already downloaded the bad bundle and don't yet have
the rollback also have a built-in failsafe: if the OTA bundle's boot
hangs or throws before app init finishes, `ota.js` marks it bad in
`localStorage` and falls back to the APK shell on the next launch.

### Local smoke test

```bash
cd mobile-app
npm install         # picks up cordova-plugin-file
cordova run android # before_prepare stamps version.js with the local SHA
```

Tail logs with `adb logcat | grep -E 'OTA|CONSOLE'`. You should see:

```
OTA: boot useOTA=false bundleVersion=<sha> ... previousBootHung=false skipOTA=false
OTA: init complete
OTA: checking https://easierbycode.com/tok-scrape/manifest.json?ts=...
OTA: up to date (<sha>)     # if the published bundle matches HEAD
```

To force a download in dev, hand-edit the published `manifest.json` to
bump `version` and `sha256` to match a hand-built zip you serve from a
tunnel, then restart the app. After the second restart the new bundle
should be active (`OTA: boot useOTA=true ...`).

## Known limitations

- **Debug-signed APK only.** Sideload requires "Install unknown apps" on the source app (your browser/file manager). For Play Store distribution you'll need a release keystore — add it as a GitHub Actions secret and switch the workflow to `cordova build android --release` with signing config in `build.json`.
- **Polled, not pushed.** The dashboard pulls on demand (or every 60s if you enable auto-refresh). If you want live updates, a future iteration could open Graylog's WebSocket alerting feed.
- **Token in localStorage.** The API token is stored in the WebView's localStorage. That's fine for a local-Graylog dev tool but don't reuse the token elsewhere.
