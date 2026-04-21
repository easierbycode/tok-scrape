# TokScrape Dashboard (Cordova Android)

A small Cordova Android app that visualizes TikTok Shop scrape data ingested into a Graylog instance. The dashboard pulls messages via Graylog's Universal Search REST API, parses the `metrics_json` and `videos_json` fields the bookmarklet writes, and renders a set of Highcharts panels.

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
        └── app.js      Auth, settings, refresh, error handling
```

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

Requirements: Node 20+, JDK 17, Android SDK with `platforms;android-35` and `build-tools;35.0.0`, environment variable `ANDROID_HOME` set.

```bash
cd mobile-app
npm install -g cordova@latest
cordova platform add android@latest
cordova build android --debug
# APK lives at: platforms/android/app/build/outputs/apk/debug/app-debug.apk
```

For a quick run on a connected device or the emulator: `cordova run android`.

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

`.github/workflows/build-apk.yml` builds a debug APK on every push to `main` that touches `mobile-app/**` and publishes it to the `gh-pages` branch as `app.apk`. With GitHub Pages enabled on the `gh-pages` branch and your custom domain (`easierbycode.com`) wired up, the APK is reachable at:

> https://easierbycode.com/tok-scrape/app.apk

The workflow also uploads the APK as a workflow run artifact (named `app-apk`) so reviewers can grab it from the Actions UI without waiting for Pages to update.

## Known limitations

- **Debug-signed APK only.** Sideload requires "Install unknown apps" on the source app (your browser/file manager). For Play Store distribution you'll need a release keystore — add it as a GitHub Actions secret and switch the workflow to `cordova build android --release` with signing config in `build.json`.
- **Polled, not pushed.** The dashboard pulls on demand (or every 60s if you enable auto-refresh). If you want live updates, a future iteration could open Graylog's WebSocket alerting feed.
- **Token in localStorage.** The API token is stored in the WebView's localStorage. That's fine for a local-Graylog dev tool but don't reuse the token elsewhere.
