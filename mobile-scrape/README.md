# mobile-scrape

Cordova app that opens the same TikTok Shop bookmarklet endpoints as the
`run-partner-center-bookmarklet` skill, but inside a phone-resident
`cordova-plugin-inappbrowser`. A floating **Run scrape** button is injected
into every page; tapping it `eval`s the matching repo-root bookmarklet against
whatever the user has navigated to.

## Targets

| Target   | URL opened                                                                  | Bookmarklet source              |
| -------- | --------------------------------------------------------------------------- | ------------------------------- |
| creator  | `https://partner.us.tiktokshop.com/compass/video-analysis`                  | `../bookmarklet-src.js`         |
| sellers  | `https://partner.us.tiktokshop.com/affiliate-campaign/partner-collabs`      | `../bookmarklet-sellers.js`     |
| live     | `https://shop.tiktok.com/workbench/live/overview`                           | `../bookmarklet-live.js`        |
| streamer | `https://shop.tiktok.com/streamer/compass/video-analysis/view`              | `../bookmarklet-streamer.js`    |

For `sellers` and `live` the canonical landing URL has no `campaign_id` /
`room_id`. Tap the card, log in if needed, then navigate inside the in-app
browser to the specific campaign or live session before tapping **Run scrape**.

## Setup

```sh
cd mobile-scrape
npm install                 # also runs scripts/sync-bookmarklets.js (postinstall)
npx cordova platform add android
npm run build               # → platforms/android/app/build/outputs/apk/debug/app-debug.apk
npm run run                 # build + install + launch on connected device
```

Re-sync the bookmarklet payloads any time the repo-root `bookmarklet-*.js`
files change (e.g. after `docker compose up` rewrites the Graylog endpoint):

```sh
npm run sync
```

`www/js/payloads.js` is generated and gitignored.

## How it works

1. Launcher (`www/index.html`) shows four cards.
2. Tapping a card calls `cordova.InAppBrowser.open(url, '_blank', …)` with a
   desktop user-agent so Partner Center serves the full Arco dashboard.
3. On every IAB `loadstop` the host calls `executeScript` to inject a fixed-
   position floating button into `document.documentElement`. The button stores
   the bookmarklet source as a string and `eval`s it on click.
4. The bookmarklet itself POSTs to the same Graylog and Apps Script endpoints
   it uses on desktop — no host-app bridging needed.

## Caveats

- Login is manual. The app never types credentials.
- TikTok Shop dashboards are desktop-targeted; the IAB sets a desktop UA but
  selectors can still break if TikTok ships a new layout.
- The injected FAB is guarded with `window.__tokScrapeFab` so SPA route
  changes don't stack duplicate buttons.
