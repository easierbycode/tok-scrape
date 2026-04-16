# tok-scrape

A tiny TikTok Shop Partner Center scraper. Two delivery modes:

- [`metrics-bookmarklet.html`](./metrics-bookmarklet.html) &mdash; a classic
  drag-to-bookmarks bookmarklet. Open on a TikTok Shop analytics page, click
  the bookmark, and the current creator's Key metrics + Videos table are
  `console.log`'d and (if configured) posted to a Google Sheet via an Apps
  Script Web App.
- [`pwa/`](./pwa/index.html) &mdash; an installable PWA companion for the
  bookmarklet (iOS **Add to Home Screen** / Chrome / Edge **Install app**).
  Offline-capable shell; local-only endpoint &amp; token editor; generates a
  personalised `javascript:` URL on demand.

The scraping itself still runs as a bookmarklet because a PWA can't execute in
the TikTok Shop origin &mdash; the PWA is the installable home for the setup
flow, docs, and endpoint editor.

## PWA

```
pwa/
├── index.html             # installable shell (Install / Setup / Docs / About tabs)
├── app.js                 # SW registration, tab routing, bookmarklet generator
├── manifest.webmanifest   # name, icons, start_url, display: standalone
├── sw.js                  # cache-first shell, network-first everything else
├── icon.svg               # any-purpose icon
└── icon-maskable.svg      # maskable icon (safe zone centered)
```

### Serve locally

Service workers require an `https://` or `http://localhost` origin, so just
open the file in a browser tab:

```
python3 -m http.server -d . 8000
# open http://localhost:8000/pwa/
```

### Deploy on GitHub Pages

1. Repo **Settings &rarr; Pages &rarr; Source**: `main` branch, `/ (root)`.
2. PWA is served at `https://<user>.github.io/tok-scrape/pwa/`.
3. First load registers the service worker and precaches the shell; subsequent
   loads work offline.

### Personalise the bookmarklet

Open the PWA &rarr; **Setup** tab and paste your Apps Script `/exec` URL,
`TOKEN`, and (optionally) your Graylog GELF endpoint. Values are stored in
`localStorage` only &mdash; nothing leaves the browser. Tap **Generate** to
refresh the `Log Key Metrics` bookmarklet on the **Install** tab, then drag it
to your bookmarks bar.

### Compared to a Cordova build

- No native toolchain (Gradle / Xcode), no `config.xml`, no store review.
- Installable on iOS (Safari), Android (Chrome), and desktop (Chrome/Edge).
- Works offline after first load via the service worker.
- Auto-updates on next launch when `sw.js` / `CACHE_VERSION` changes.

## Google Sheet backend

See [`apps-script/Code.gs`](./apps-script/Code.gs). Set `TOKEN` in Script
properties, deploy as a Web app, paste the `/exec` URL and `TOKEN` into the
PWA **Setup** tab (or directly into `metrics-bookmarklet.html`).

Two tabs are written:

- **Metrics** &mdash; append-only, one row per metric per scrape.
- **Videos** &mdash; upserted by Video ID.
