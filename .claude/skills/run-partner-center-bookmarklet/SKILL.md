---
name: run-partner-center-bookmarklet
description: Run bookmarklet-src.js against the TikTok Shop Partner Center video-analysis dashboard via the Claude in Chrome extension. Accepts "dev" (local partner-center.html fixture, default) or "prod" (live partner.us.tiktokshop.com). Trigger on phrases like "run the partner center bookmarklet", "scrape the partner center", or "/run-partner-center-bookmarklet".
---

# run-partner-center-bookmarklet

Automate the manual step of opening the TikTok Shop Partner Center dashboard and clicking the scraper bookmark. Drives the user's real Chrome via the Claude in Chrome extension so TikTok login cookies are reused — credentials are never typed by Claude.

## Inputs

- `$1` — environment: `dev` (default) or `prod`.
  - `dev` → load the local fixture at `file:///Users/danieljohnson/CODE/tok-scrape/partner-center.html`. Safe for offline testing. POSTs still fire to the real Graylog/Sheets endpoints, so rows will appear tagged with the fixture's creator.
  - `prod` → load live `https://partner.us.tiktokshop.com/compass/video-analysis`. Requires the user to already be logged in.

## Required tools

All from the Claude in Chrome MCP (`mcp__Claude_in_Chrome__*`): `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `javascript_tool`, `read_console_messages`, `read_network_requests`, `read_page`, `mcp__computer-use__screenshot` as a fallback for debugging. Plus `Read` for disk access to `bookmarklet-src.js`.

If the extension isn't connected, stop and tell the user to install/connect it — do not fall back to computer-use mouse-clicks on Chrome (it's tier-"read" and clicks are blocked).

## Steps

1. **Read `bookmarklet-src.js` from disk** (repo root: `/Users/danieljohnson/CODE/tok-scrape/bookmarklet-src.js`). Parse out the `GRAYLOG_ENDPOINT` and `ENDPOINT` values so you can filter network requests to those hosts later. If `GRAYLOG_ENDPOINT` does not contain `ngrok`, warn the user that the endpoint looks stale and stop — they probably need to run `docker compose up -d` in the repo to re-run `scripts/sync-bookmarklet.py`.

2. **Resolve the target URL** based on `$1`:
   - `dev` (default) → `file:///Users/danieljohnson/CODE/tok-scrape/partner-center.html`
   - `prod` → `https://partner.us.tiktokshop.com/compass/video-analysis`

3. **Find or create the tab.** Call `tabs_context_mcp` to list open tabs. If one already matches the target URL (startsWith match on origin+path), reuse it and `navigate` to force a refresh. Otherwise, open a new tab via `tabs_create_mcp` with the target URL.

4. **Prod login gate.** In `prod` mode, after the nav settles, use `read_page` to check for a TikTok login form (text like "Log in", "Enter password", or the URL pattern `accounts.tiktok` / `/login`). If detected, stop and say:
   > The Partner Center redirected to a login page. Please log in manually in that Chrome tab, then re-run the skill.
   Do not type credentials. Do not click login buttons on the user's behalf.

5. **Wait for the Arco dashboard.** Poll up to ~20 seconds by calling `javascript_tool` repeatedly with this readiness probe:
   ```js
   (() => ({
     spaces: document.querySelectorAll('.arco-space-item').length,
     hasRow: !!document.querySelector('tbody tr.arco-table-tr')
   }))()
   ```
   Ready when `spaces >= 3 && hasRow === true`. Between polls wait ~1s (re-call the tool; do not use a sleep loop). On timeout, take a `preview_screenshot` / `computer-use screenshot` and report which condition failed.

6. **Inject the bookmarklet.** Call `javascript_tool` once, passing the exact contents of `bookmarklet-src.js` as-is. The file already wraps itself as `(function(){ ... })();` so no additional wrapping is needed. Do not modify the source in-memory.

7. **Verify.**
   - Call `read_console_messages` and look for:
     - A logged payload object (the `console.log(payload)` line).
     - `[sheet]` followed by a JSON response like `{ok:true, metricsWritten:N, videosUpserted:M}`.
     - `[graylog] sent` with a status (will be `opaque` because the Graylog POST uses `mode:'no-cors'` — that's expected, still a success signal).
   - Call `read_network_requests` filtered to the two hosts parsed in step 1:
     - `script.google.com` → expect a POST; status should be 200 (or a 302 follow-redirect; Apps Script sometimes redirects).
     - The Graylog ngrok host → expect a POST request to exist. The response will be opaque (status 0 in the CORS sense), so assert only that the **request was sent**, not that the status was 200.
   - If either the Sheets POST or the Graylog POST is missing entirely, or if the console shows `Key metrics container not found` / `[sheet] post failed` / `[graylog] post failed`, capture a screenshot and surface the error verbatim.

8. **Summarize back to the user.** Report: env used, final URL, `metricsWritten` / `videosUpserted` from the Sheets response (if present), the Graylog status, and any warnings.

## Guardrails — do not

- Never type TikTok credentials or click login buttons. Login is always manual.
- Never hardcode or inline the bookmarklet source. Always `Read` it fresh from disk so the ngrok URL and Graylog token written by `scripts/sync-bookmarklet.py` are current.
- Never run `docker compose up` or `scripts/sync-bookmarklet.py` as a preflight. If endpoints look stale, fail fast with a clear message.
- Never retry the injection on timeout — surface the failure so the selectors can be fixed. The Arco classes are fragile and silent retries mask DOM regressions.
- If the Claude in Chrome extension is not connected, stop and ask the user to install/connect it — do not drive Chrome via `mcp__computer-use__*` (tier-"read" blocks clicks/typing on browsers).

## Notes

- The Graylog POST uses `mode: 'no-cors'`, so in the Network panel its response appears as opaque/status 0. This is by design. Presence of the request is the success signal.
- The fixture at `partner-center.html` is a snapshot of the real Arco DOM, so the same selectors and readiness probe work in both `dev` and `prod`.
- For a headless / CI variant of this flow, see `scripts/run-bookmarklet.ts` (Playwright-based, supports the same `--env=dev|prod` toggle).
