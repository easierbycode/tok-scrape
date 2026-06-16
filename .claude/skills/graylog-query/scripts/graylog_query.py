#!/usr/bin/env python3
"""Query the TokScrape Graylog from the command line.

Thin, dependency-free wrapper around Graylog's "Universal Search (relative)"
REST endpoint:

    GET /api/search/universal/relative?query=<lucene>&range=<seconds>&...

It exists so Claude (and humans) can ask Graylog questions without re-deriving
the auth scheme, the Lucene quirks, and Graylog 7's error shapes every time.
Everything here mirrors the battle-tested browser client in
`mobile-app/www/js/api.js` — same endpoint, same Basic-auth scheme, same
empty-window handling.

Auth
----
Graylog access tokens go in the HTTP Basic *username* slot with the literal
password "token" (yes, really — see the Graylog docs and api.js). So a token
`abc` becomes `Authorization: Basic base64("abc:token")`. A normal
username/password (e.g. the admin login) is just `base64("user:pass")`.

Credential resolution, highest priority first:
  1. --user/--password   (or env GRAYLOG_USER / GRAYLOG_PASSWORD)
  2. --token             (or env GRAYLOG_TOKEN)
  3. the committed token in extension-seller/config.js  (default; may be STALE)

The committed token is whatever the last `docker compose up` / cluster cutover
wrote. After a failover or a Mongo rebuild it can stop being recognised and
every call 401s — this tool detects that and tells you how to recover instead
of dumping a raw stack trace. See the SKILL.md "Auth" section.

URL resolution:
  1. --url   (or env GRAYLOG_API_URL)
  2. default: https://tok-graylog-api.ngrok-free.dev   (the public ngrok domain)
  Use http://localhost:9000 for a local stack.

Examples
--------
    # What sources / streams exist, and how many messages in each (last 90d)?
    graylog_query.py --list-sources --last 90d

    # Latest 20 affiliate-export order rows for one creator, all time:
    graylog_query.py --all --limit 20 \
        --query 'source:tiktok-affiliate-export AND creator:"@wizardofdealz"' \
        --fields creator,product_name,gmv_num,order_date

    # Count rows per creator in a source (client-side aggregation):
    graylog_query.py --all --terms creator --query source:tiktok-affiliate-export

    # Raw JSON for piping into jq / further processing:
    graylog_query.py --query 'source:tiktok-bookmarklet-live' --last 7d --json

    # Use the admin login instead of the token (e.g. when the token is stale):
    GRAYLOG_USER=admin GRAYLOG_PASSWORD='ChangeMeAdmin!' \
        graylog_query.py --list-sources --all
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

DEFAULT_URL = "https://tok-graylog-api.ngrok-free.dev"
FIVE_YEARS_SECONDS = 5 * 365 * 24 * 3600
DEFAULT_RANGE_SECONDS = 30 * 24 * 3600  # 30 days
# Sane default columns when the caller doesn't pass --fields.
DEFAULT_COLUMNS = ["timestamp", "source", "creator", "short_message"]

# Where the committed (default) token lives. Resolved relative to this file so
# the tool works regardless of the current working directory.
_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", "..", ".."))
CONFIG_JS = os.path.join(_REPO_ROOT, "extension-seller", "config.js")


# --------------------------------------------------------------------------- #
# Credential + URL resolution
# --------------------------------------------------------------------------- #
def token_from_config_js(path: str = CONFIG_JS) -> str | None:
    """Best-effort scrape of `var GRAYLOG_TOKEN = '...'` from config.js."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            text = fh.read()
    except OSError:
        return None
    m = re.search(r"GRAYLOG_TOKEN\s*=\s*['\"]([^'\"]+)['\"]", text)
    return m.group(1) if m else None


def resolve_auth(args) -> tuple[str, str]:
    """Return (basic_auth_b64, human_label) for the Authorization header."""
    user = args.user or os.environ.get("GRAYLOG_USER")
    password = args.password if args.password is not None else os.environ.get("GRAYLOG_PASSWORD")
    if user:
        creds = f"{user}:{password or ''}"
        return _b64(creds), f"user '{user}'"

    token = args.token or os.environ.get("GRAYLOG_TOKEN") or token_from_config_js()
    if token:
        src = "flag/env" if (args.token or os.environ.get("GRAYLOG_TOKEN")) else "config.js"
        return _b64(f"{token}:token"), f"API token ({src}, …{token[-6:]})"

    sys.exit(
        "No Graylog credential found. Pass --token / --user+--password, set "
        "GRAYLOG_TOKEN or GRAYLOG_USER+GRAYLOG_PASSWORD, or make sure "
        f"{CONFIG_JS} has a GRAYLOG_TOKEN."
    )


def _b64(s: str) -> str:
    return base64.b64encode(s.encode("utf-8")).decode("ascii")


def resolve_range(args) -> int:
    if args.all:
        return FIVE_YEARS_SECONDS
    if args.range is not None:
        return args.range
    if args.last:
        return parse_duration(args.last)
    return DEFAULT_RANGE_SECONDS


_DUR_UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


def parse_duration(s: str) -> int:
    """'90d' -> 7776000, '24h' -> 86400, '45m' -> 2700, plain '3600' -> 3600."""
    s = s.strip().lower()
    if s.isdigit():
        return int(s)
    m = re.fullmatch(r"(\d+)\s*([smhdw])", s)
    if not m:
        sys.exit(f"Bad --last value {s!r}. Use forms like 7d, 24h, 90m, 3600.")
    return int(m.group(1)) * _DUR_UNITS[m.group(2)]


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
def search(base_url: str, auth_b64: str, query: str, range_seconds: int,
           fields: list[str] | None, limit: int, sort: str, timeout: float = 30.0) -> dict:
    """Hit universal/relative. Returns the parsed JSON, or an empty-window
    sentinel for Graylog 7's index_not_found 500."""
    params = {
        "query": query or "*",
        "range": str(range_seconds),
        "limit": str(limit),
        "sort": sort,
    }
    if fields:
        params["fields"] = ",".join(fields)
    url = base_url.rstrip("/") + "/api/search/universal/relative?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method="GET", headers={
        "Authorization": "Basic " + auth_b64,
        "Accept": "application/json",
        # Graylog rejects state-changing requests without this; harmless on GETs.
        "X-Requested-By": "graylog-query-skill",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
        return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        if e.code == 401:
            sys.exit(_auth_help(body))
        # A search window newer than (or disjoint from) every index range makes
        # Graylog 7 return a 500 carrying index_not_found_exception. That's "no
        # results in this window", not a failure — mirror api.js and treat it as
        # an empty result so the caller doesn't see a scary error.
        if e.code == 500 and "index_not_found_exception" in body:
            return {"messages": [], "total_results": 0, "_empty_window": True}
        sys.exit(f"Graylog HTTP {e.code} {e.reason}\n{_trim(body)}")
    except urllib.error.URLError as e:
        sys.exit(
            f"Could not reach Graylog at {base_url} ({e.reason}). "
            "Is the ngrok tunnel up / the cluster online? A 502 usually means "
            "the Graylog container is down (e.g. MongoDB has no PRIMARY)."
        )


def _auth_help(body: str) -> str:
    return (
        "Graylog rejected the credential (HTTP 401).\n"
        "The committed token in extension-seller/config.js is the usual suspect — "
        "it stops working after a failover or a Mongo rebuild mints a new token DB.\n"
        "Fix one of these ways:\n"
        "  • Mint a fresh API token in the UI (System > Users > admin > Edit tokens), "
        "then pass it with --token or set GRAYLOG_TOKEN (and update config.js + the "
        "GRAYLOG_TOKEN_PROD secret so the rest of the stack stays in sync).\n"
        "  • Or use the admin login for a one-off: "
        "GRAYLOG_USER=admin GRAYLOG_PASSWORD='<admin-pw>' graylog_query.py ...\n"
        f"{_trim(body)}"
    )


def _trim(body: str, n: int = 600) -> str:
    body = (body or "").strip()
    return body if len(body) <= n else body[:n] + " …"


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #
def messages_to_rows(resp: dict) -> list[dict]:
    return [(m.get("message") or {}) for m in (resp.get("messages") or [])]


def render_terms(rows: list[dict], field: str) -> str:
    """Client-side aggregation. Graylog 7 removed the legacy universal/terms
    endpoint (it 404s), so we count over the fetched messages instead. This is
    exact when `limit` covers the result set; if it doesn't, raise --limit."""
    counts: dict[str, int] = {}
    missing = 0
    for r in rows:
        v = r.get(field)
        if v is None or v == "":
            missing += 1
            continue
        key = str(v)
        counts[key] = counts.get(key, 0) + 1
    if not counts and not missing:
        return f"(no values for field {field!r} in the fetched messages)"
    width = max((len(k) for k in counts), default=len(field))
    lines = [f"{'value':<{width}}  count", f"{'-' * width}  -----"]
    for k, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
        lines.append(f"{k:<{width}}  {c}")
    if missing:
        lines.append(f"{'(field absent)':<{width}}  {missing}")
    return "\n".join(lines)


def render_table(rows: list[dict], columns: list[str]) -> str:
    if not rows:
        return "(no messages)"
    cols = columns or _auto_columns(rows)
    widths = {c: len(c) for c in cols}
    cells = []
    for r in rows:
        row = {c: _short(r.get(c)) for c in cols}
        for c in cols:
            widths[c] = max(widths[c], len(row[c]))
        cells.append(row)
    header = "  ".join(c.ljust(widths[c]) for c in cols)
    sep = "  ".join("-" * widths[c] for c in cols)
    out = [header, sep]
    for row in cells:
        out.append("  ".join(row[c].ljust(widths[c]) for c in cols))
    return "\n".join(out)


def _auto_columns(rows: list[dict]) -> list[str]:
    present = {k for r in rows for k in r.keys()}
    cols = [c for c in DEFAULT_COLUMNS if c in present]
    return cols or ["timestamp", "source"]


def _short(v, n: int = 70) -> str:
    if v is None:
        return ""
    s = str(v).replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Query the TokScrape Graylog (Universal Search, relative).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("-q", "--query", default="*",
                   help="Lucene query. Default '*' (everything). "
                        'e.g. source:tiktok-affiliate-export AND creator:"@wizardofdealz"')
    g = p.add_mutually_exclusive_group()
    g.add_argument("--last", help="Relative window: 7d, 24h, 90m, 3600 (seconds).")
    g.add_argument("--range", type=int, help="Relative window in seconds.")
    g.add_argument("--all", action="store_true", help="~5 years (effectively all time).")
    p.add_argument("--fields", help="Comma-separated field whitelist for results.")
    p.add_argument("--limit", type=int, default=200, help="Max messages to fetch (default 200).")
    p.add_argument("--sort", default="timestamp:desc", help="Sort, e.g. timestamp:desc.")
    p.add_argument("--terms", metavar="FIELD",
                   help="Aggregate: count messages per distinct value of FIELD (client-side).")
    p.add_argument("--list-sources", action="store_true",
                   help="Shortcut for --terms source over the current query.")
    p.add_argument("--json", action="store_true", help="Print raw Graylog JSON.")
    p.add_argument("--show-url", action="store_true", help="Print the request URL (no creds) and exit.")
    p.add_argument("--url", help=f"Graylog API base. Default {DEFAULT_URL} (env GRAYLOG_API_URL).")
    p.add_argument("--token", help="Graylog API token (env GRAYLOG_TOKEN).")
    p.add_argument("--user", help="Username for Basic auth (env GRAYLOG_USER), e.g. admin.")
    p.add_argument("--password", help="Password for --user (env GRAYLOG_PASSWORD).")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    base_url = args.url or os.environ.get("GRAYLOG_API_URL") or DEFAULT_URL
    range_seconds = resolve_range(args)

    # Aggregation modes need enough messages to be exact; bump a tiny --limit.
    agg_field = "source" if args.list_sources else args.terms
    limit = args.limit
    if agg_field and limit < 1000:
        limit = 10000
    # For aggregation we only need the one field; keeps payloads small.
    fields = [agg_field] if agg_field else ([f.strip() for f in args.fields.split(",")] if args.fields else None)

    if args.show_url:
        params = {"query": args.query or "*", "range": str(range_seconds),
                  "limit": str(limit), "sort": args.sort}
        if fields:
            params["fields"] = ",".join(fields)
        print(base_url.rstrip("/") + "/api/search/universal/relative?" + urllib.parse.urlencode(params))
        return 0

    auth_b64, label = resolve_auth(args)
    resp = search(base_url, auth_b64, args.query, range_seconds, fields, limit, args.sort)

    if args.json:
        print(json.dumps(resp, indent=2, ensure_ascii=False))
        return 0

    total = resp.get("total_results", 0)
    took = resp.get("time")
    rows = messages_to_rows(resp)
    window = "all time (~5y)" if range_seconds >= FIVE_YEARS_SECONDS else f"last {range_seconds}s"

    head = f"query={args.query!r}  window={window}  total_results={total}"
    if took is not None:
        head += f"  ({took}ms)  via {label}"
    print(head)
    print()

    if agg_field:
        print(render_terms(rows, agg_field))
    else:
        print(render_table(rows, fields))

    # Help the user tell "genuinely empty" apart from "indexes not registered".
    if total == 0:
        if resp.get("_empty_window"):
            print("\n(empty window: no index covers this time range — try --all "
                  "or a wider --last.)")
        elif not resp.get("used_indices"):
            print("\n(0 results and no index ranges were consulted. Either there's "
                  "no data in this window, or index ranges are stale after a "
                  "restore — an admin can rebuild them: "
                  "POST /api/system/indices/ranges/rebuild.)")
    elif len(rows) >= limit and not agg_field:
        print(f"\n(showing first {limit}; total is {total} — raise --limit for more.)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
