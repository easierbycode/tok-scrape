# tok-scrape

Scraper bookmarklets for [TikTok Shop Partner Center](https://partner.us.tiktokshop.com), plus the Claude skill and headless Playwright runner that automate clicking them. Each scrape POSTs to a Google Sheet (via Apps Script) and to a local Graylog instance (via GELF HTTP through ngrok).

## What's in the repo

| File / dir | Purpose |
| --- | --- |
| `bookmarklet-src.js` | **Creator** bookmarklet — scrapes a creator's video-analysis dashboard (`partner.us.tiktokshop.com/compass/video-analysis`). One row per video. |
| `bookmarklet-sellers.js` | **Sellers** bookmarklet — scrapes a Partner Collabs Agency Detail page (`partner.us.tiktokshop.com/affiliate-campaign/partner-collabs/agency/detail?campaign_id=…`). One row per (product, shop). **Graylog-only** — no Sheets POST, since the seller payload doesn't fit the creator-oriented Sheet schema. |
| `bookmarklet-live.js` | **Live** bookmarklet — scrapes the seller-side LIVE Dashboard (`shop.tiktok.com/workbench/live/overview?room_id=…`). Per-session GMV, items sold, viewers, performance trends, traffic sources, product list. |
| `bookmarklet-streamer.js` | **Streamer** bookmarklet — scrapes the seller-side Streamer Compass video-analysis view (`shop.tiktok.com/streamer/compass/video-analysis/view`). The seller's own video dashboard: 5 KPI tiles (GMV / Items sold / Views / New followers / Videos) + a stack of video cards each with their own metrics row (GMV / Views / Items sold / CTR / Completion). |
| `index.html` | Drag-to-bookmark page. Hosts all four bookmarklets; `data-source="creator"` / `"sellers"` / `"live"` / `"streamer"` markers let the sync sidecar rewrite each block independently. |
| `sellers.html` | Dedicated drag-to-bookmark page for the sellers bookmarklet only — same `data-source="sellers"` markers as on `index.html`, just isolated for users who only want that one. |
| `partner-center.html` / `partner-center2.html` / `seller-center.html` / `seller-center2.html` | Saved DOM snapshots used as offline fixtures for `dev`-mode runs. |
| `.claude/skills/run-partner-center-bookmarklet/SKILL.md` | Claude skill that drives the user's real Chrome via the [Claude in Chrome](https://www.anthropic.com/news/claude-in-chrome) extension. |
| `scripts/run-bookmarklet.ts` | Playwright headless runner — same toggles as the skill, for CI / repeated runs. |
| `scripts/sync-bookmarklet.py` | Docker sidecar that mints a Graylog API token, then rewrites every bookmarklet's `GRAYLOG_ENDPOINT` / `GRAYLOG_TOKEN` and re-encodes the drag links in `index.html`. |
| `scripts/seed-graylog.py` | Seeds the local Graylog with synthetic creator scrapes for dashboard development. |
| `docker-compose.yml`, `ngrok.yml` | Local Graylog + ngrok stack. |
| `apps-script/` | Google Apps Script Web App that the bookmarklets POST to. |

All four bookmarklets share the same Graylog GELF endpoint and use distinct `GRAYLOG_HOST` values so Graylog routes them as separate sources. Creator, live, and streamer also POST to a shared Apps Script `ENDPOINT`; sellers is Graylog-only.

- `source:tiktok-bookmarklet` — creator/video stream
- `source:tiktok-bookmarklet-sellers` — sellers/shops stream
- `source:tiktok-bookmarklet-live` — live-dashboard stream
- `source:tiktok-bookmarklet-streamer` — streamer compass stream

## One-time setup

1. **Boot the local Graylog stack:**
   ```sh
   export NGROK_AUTHTOKEN=<your-token>   # https://dashboard.ngrok.com/get-started/your-authtoken
   docker compose up -d
   docker compose logs -f bookmarklet-sync
   ```
   Wait for the summary block. The sidecar mints a Graylog admin token, opens two ngrok tunnels (Graylog UI + GELF input), and rewrites the GELF URL + token into both `bookmarklet-src.js` and `bookmarklet-sellers.js` (and re-encodes their drag links in `index.html`).

2. **Drag the bookmarks.** Open `index.html` in a browser and drag any of the "Log Key Metrics", "Log Sellers", and "Log Live Session" links to your bookmarks bar. (If you only want the sellers one, open `sellers.html` instead — the drag link there is the same encoded source.)

3. **(Optional) Capture login cookies for the headless runner:**
   ```sh
   cd scripts && npm install
   npm run bookmarklet:login
   ```
   This opens a headed Chromium where you log into TikTok Shop once. Cookies persist to `./.pw-profile` for future `--env=prod` runs.

Re-run `docker compose up` (or just `docker compose restart bookmarklet-sync`) any time you want fresh ngrok URLs. The sidecar rewrites everything in place; no manual sync needed.

## Using the Claude skill

`run-partner-center-bookmarklet` uses the Claude in Chrome extension (`mcp__Claude_in_Chrome__*`) to drive your real browser session — TikTok cookies are reused, Claude never types credentials.

**Two args, both optional:**

```
/run-partner-center-bookmarklet [env] [target]
```

- `env`: `dev` (default, local fixture) | `prod` (live TikTok Shop)
- `target`: `creator` (default) | `sellers` | `live` | `streamer`

| Invocation | What happens |
| --- | --- |
| `/run-partner-center-bookmarklet` | Creator bookmarklet against the local `partner-center.html` fixture. |
| `/run-partner-center-bookmarklet prod` | Creator bookmarklet against the live `/compass/video-analysis` page. |
| `/run-partner-center-bookmarklet dev sellers` | Sellers bookmarklet against the local `partner-center2.html` fixture. |
| `/run-partner-center-bookmarklet prod sellers` | Sellers bookmarklet against an already-open Partner Collabs Agency Detail tab. The skill will refuse to navigate — you must already be viewing the campaign you want to scrape, since each campaign has its own `campaign_id`. |
| `/run-partner-center-bookmarklet dev live` | Live bookmarklet against the local `seller-center.html` fixture. |
| `/run-partner-center-bookmarklet prod live` | Live bookmarklet against an already-open Seller Center LIVE Dashboard tab. Same pattern as sellers/prod — each session has its own `room_id`, so the skill refuses to guess one. |
| `/run-partner-center-bookmarklet dev streamer` | Streamer bookmarklet against the local `seller-center2.html` fixture. |
| `/run-partner-center-bookmarklet prod streamer` | Streamer bookmarklet against the live `/streamer/compass/video-analysis/view` page (single canonical URL — the seller's own dashboard). |

Trigger phrases that also work: "run the partner center bookmarklet", "scrape the partner center", "scrape sellers", "scrape live dashboard".

The skill reads the bookmarklet source fresh from disk on every run, so the ngrok URL and Graylog token written by `scripts/sync-bookmarklet.py` are always current. If the endpoint doesn't look like an ngrok URL it stops with a clear message — re-run `docker compose up`.

For `sellers`, only the **currently active status tab** (Pending / Approved / Rejected / Pending closed / Closed) is scraped; switch tabs in the browser before re-running if you want a different status.

For `live`, the LIVE Dashboard is real-time per session — the GMV odometer animates on load and the Performance trends carousel auto-rotates. The bookmarklet captures whatever the page shows at the moment of the click; the carousel slides all stay mounted, so every metric is captured regardless of which one is on-screen.

If the Claude in Chrome extension isn't connected, the skill stops and asks you to install/connect it. It won't fall back to computer-use clicks (Chrome is tier-"read" so clicks would be blocked anyway).

## Using the Playwright runner

Same toggles as the skill, but headless and scriptable. Lives at `scripts/run-bookmarklet.ts`; runs via `tsx`. Cookies persist to `scripts/.pw-profile` between runs.

```sh
cd scripts
npm install     # first time only
```

| npm script | Equivalent invocation |
| --- | --- |
| `npm run bookmarklet` | `tsx run-bookmarklet.ts` (creator + dev, the default) |
| `npm run bookmarklet:dev` | `--env=dev` |
| `npm run bookmarklet:prod` | `--env=prod` |
| `npm run bookmarklet:sellers` | `--target=sellers --env=dev` |
| `npm run bookmarklet:sellers:prod` | `--target=sellers --env=prod` |
| `npm run bookmarklet:live` | `--target=live --env=dev` |
| `npm run bookmarklet:live:prod` | `--target=live --env=prod` |
| `npm run bookmarklet:streamer` | `--target=streamer --env=dev` |
| `npm run bookmarklet:streamer:prod` | `--target=streamer --env=prod` |
| `npm run bookmarklet:login` | `--env=prod --login-only` (capture cookies) |

Or call `tsx run-bookmarklet.ts` directly with any combination of flags:

```
--target=creator|sellers|live|streamer  default: creator
--env=dev|prod                          default: dev
--campaign-id=ID                        required for --target=sellers --env=prod
--room-id=ID                            required for --target=live --env=prod
--profile=PATH                          persistent context dir, default ./.pw-profile
--login-only                            headed login flow, no injection
--timeout=MS                            readiness probe timeout, default 30000
```

Examples:

```sh
# Creator scrape against the live dashboard:
npm run bookmarklet:prod

# Sellers scrape of one specific campaign in prod:
npx tsx run-bookmarklet.ts --target=sellers --env=prod \
    --campaign-id=7602081624227088159

# Live scrape of one specific session in prod:
npx tsx run-bookmarklet.ts --target=live --env=prod \
    --room-id=7630167109884611358

# Force headed (e.g. to watch what's happening in prod):
PLAYWRIGHT_HEADED=1 npm run bookmarklet:prod
```

The runner mirrors the skill's verification: it tracks requests to the Apps Script and Graylog hosts and exits non-zero if neither fires.

## How the sync sidecar works

`scripts/sync-bookmarklet.py` runs as a one-shot container in `docker-compose.yml`. On each `docker compose up` it:

1. Waits for the `graylog-api` and `graylog-gelf` ngrok tunnels.
2. Waits for Graylog's REST API.
3. Creates (or reuses) an admin API token named `mobile-app`.
4. For each entry in its `BOOKMARKLETS` registry — currently `bookmarklet-src.js` (slug `creator`), `bookmarklet-sellers.js` (slug `sellers`), and `bookmarklet-live.js` (slug `live`) — rewrites `GRAYLOG_ENDPOINT` and `GRAYLOG_TOKEN`. Then for each host page in its `INDEX_FILES` list (`index.html`, `sellers.html`), splices the re-URL-encoded source into every `<a class="bm" data-source="<slug>">` and `<pre><code data-source="<slug>">` block it carries. Splicing is tolerant of missing markers, so a page with only some slugs (like `sellers.html`) and a page with all slugs (like `index.html`) both stay in sync without per-file branches.
5. Prints a summary block (Graylog URL, token, Lucene query) for the mobile app.

Adding a third bookmarklet later: one tuple in `BOOKMARKLETS`, plus a `data-source="<slug>"` anchor + `<pre><code data-source="<slug>">` block in whichever pages should host it. To add a third drag page, add it to `INDEX_FILES`. No other code changes.

## Troubleshooting

- **"GRAYLOG_ENDPOINT does not look like an ngrok URL"** — your bookmarklet has a stale endpoint baked in. Run `docker compose up` (or `docker compose restart bookmarklet-sync`) and re-drag the bookmark.
- **`redirected to login` in Playwright runs** — your cookies expired. Re-run `npm run bookmarklet:login` to refresh.
- **Sellers scrape returns 0 rows** — the active status tab probably has 0 entries. Click a tab with a non-zero count and re-run.
- **Sellers prod fails with "no Partner Collabs Agency Detail tab is open"** — the skill won't guess a `campaign_id`. Navigate to the campaign first, then re-run. (For the runner, pass `--campaign-id=<id>` instead.)
- **Live prod fails with "no Seller Center LIVE Dashboard tab is open"** — same pattern: navigate to the live session first, then re-run. (For the runner, pass `--room-id=<id>` instead.)
- **Apps Script returns `metricsWritten: 0, videosUpserted: 0` for live** — expected for now; the Apps Script handles the creator schema. The Graylog stream still receives the full payload. (Sellers is Graylog-only and skips Sheets entirely, so no `[sheet]` line at all.)
- **Graylog request shows status 0 / opaque** — by design. The bookmarklet uses `mode: 'no-cors'` so the response is opaque; presence of the request is the success signal.

## Headless runner vs. Claude skill — which to use?

- **Skill** when you're already in a Claude session and want a one-off scrape, or when the data you want depends on UI state (which sellers status tab is active, which campaign tab is open). Reuses your real Chrome cookies.
- **Playwright runner** for CI, scheduled jobs, or batch runs. Uses its own persistent profile (`scripts/.pw-profile`) — log in once, run unattended after.

Both inject the same on-disk bookmarklet source, so endpoint/token rewrites from `sync-bookmarklet.py` apply to both automatically.
