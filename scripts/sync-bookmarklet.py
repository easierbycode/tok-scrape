#!/usr/bin/env python3
"""
Sidecar that runs inside docker compose once the Graylog stack + ngrok are up.

It:
  1. Polls the local ngrok inspector API (http://ngrok:4040) until both the
     `graylog-api` and `graylog-gelf` tunnels (defined in ngrok.yml) are live.
  2. Polls the Graylog REST API until healthy.
  3. Creates (or reuses) an admin API token named $GRAYLOG_TOKEN_NAME.
  4. Rewrites `bookmarklet-src.js` with the current GELF ngrok URL + token,
     then re-URL-encodes and splices the result into the <a class="bm"> href
     and the visible <pre><code> source block in `index.html`.
  5. Prints a summary block so `docker compose logs bookmarklet-sync` shows
     the public URLs + token to paste into the mobile app.

All config comes from env vars (set in docker-compose.yml). The repo is mounted
at /workspace so this writes back to the host files.
"""
import base64
import html
import json
import os
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request


WORKSPACE        = pathlib.Path(os.environ.get("WORKSPACE", "/workspace"))
NGROK_API        = os.environ.get("NGROK_API", "http://ngrok:4040/api/tunnels")
GRAYLOG_BASE     = os.environ.get("GRAYLOG_BASE", "http://graylog:9000")
ADMIN_USER       = os.environ.get("GRAYLOG_ADMIN_USER", "admin")
ADMIN_PW         = os.environ.get("GRAYLOG_ADMIN_PASSWORD", "ChangeMeAdmin!")
TOKEN_NAME       = os.environ.get("GRAYLOG_TOKEN_NAME", "mobile-app")
TUNNEL_API_NAME  = "graylog-api"
TUNNEL_GELF_NAME = "graylog-gelf"


def log(msg: str) -> None:
    print(f"[bookmarklet-sync] {msg}", flush=True)


def http_get(url: str, headers: dict | None = None, timeout: float = 10.0) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b""


def http_post(url: str, body: bytes, headers: dict, timeout: float = 10.0) -> tuple[int, bytes]:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read() or b""


def basic_auth(user: str, password: str) -> str:
    raw = f"{user}:{password}".encode()
    return "Basic " + base64.b64encode(raw).decode()


def wait_for(name: str, predicate, tries: int = 180, delay: float = 2.0) -> None:
    log(f"waiting for {name} ...")
    for i in range(tries):
        try:
            if predicate():
                log(f"{name} ready.")
                return
        except Exception as e:
            if i == 0:
                log(f"{name} not yet ready ({type(e).__name__}: {e})")
        time.sleep(delay)
    raise SystemExit(f"timed out waiting for {name}")


def fetch_tunnels() -> dict[str, str]:
    """Return {name: public_url} for each ngrok tunnel, preferring https."""
    status, body = http_get(NGROK_API, timeout=5.0)
    if status != 200:
        raise RuntimeError(f"ngrok inspector HTTP {status}")
    data = json.loads(body.decode())
    out: dict[str, str] = {}
    for t in data.get("tunnels", []):
        name = t.get("name", "")
        url = t.get("public_url", "")
        if not name or not url:
            continue
        # Prefer https if both https/http variants of the same tunnel exist.
        if name in out and out[name].startswith("https://"):
            continue
        out[name] = url
    return out


def get_graylog_token() -> str:
    auth = {"Authorization": basic_auth(ADMIN_USER, ADMIN_PW), "X-Requested-By": "bookmarklet-sync"}
    # Try to create. On 200/201 we get {"token": "..."}.
    status, body = http_post(
        f"{GRAYLOG_BASE}/api/users/{ADMIN_USER}/tokens/{urllib.parse.quote(TOKEN_NAME)}",
        b"{}",
        {**auth, "Content-Type": "application/json"},
    )
    if status in (200, 201):
        token = json.loads(body.decode()).get("token", "")
        if token:
            return token
    # Fall back to listing.
    status, body = http_get(f"{GRAYLOG_BASE}/api/users/{ADMIN_USER}/tokens", headers=auth)
    if status != 200:
        raise RuntimeError(f"graylog token list HTTP {status}: {body[:200]!r}")
    for t in json.loads(body.decode()).get("tokens", []):
        if t.get("name") == TOKEN_NAME and t.get("token"):
            return t["token"]
    raise RuntimeError("could not create or find Graylog API token")


def rewrite_bookmarklet(gelf_endpoint: str, token: str) -> None:
    src_path = WORKSPACE / "bookmarklet-src.js"
    idx_path = WORKSPACE / "index.html"

    src = src_path.read_text()
    src, n1 = re.subn(
        r"var GRAYLOG_ENDPOINT = '[^']*';",
        "var GRAYLOG_ENDPOINT = '" + gelf_endpoint + "';",
        src, count=1,
    )
    src, n2 = re.subn(
        r"var GRAYLOG_TOKEN(\s*)= '[^']*';",
        r"var GRAYLOG_TOKEN\1= '" + token.replace("\\", r"\\") + "';",
        src, count=1,
    )
    if n1 != 1 or n2 != 1:
        raise SystemExit(f"bookmarklet-src.js: endpoint replaced={n1}, token replaced={n2}")
    src_path.write_text(src)

    body = src.rstrip()
    href   = "javascript:" + urllib.parse.quote(body, safe="")
    pretty = "javascript:" + html.escape(body, quote=False)

    idx = idx_path.read_text()
    idx, n_href = re.subn(
        r'(<a class="bm" href=")[^"]*(")',
        lambda m: m.group(1) + href.replace("\\", r"\\") + m.group(2),
        idx, count=1,
    )
    if n_href != 1:
        raise SystemExit('failed to locate <a class="bm"> in index.html')

    start_marker = "<pre><code>javascript:(function(){"
    end_marker   = "})();</code></pre>"
    s = idx.find(start_marker)
    e = idx.find(end_marker, s) if s >= 0 else -1
    if s < 0 or e < 0:
        raise SystemExit("failed to locate <pre><code> bookmarklet source block in index.html")
    idx = idx[:s] + "<pre><code>" + pretty + "</code></pre>" + idx[e + len(end_marker):]
    idx_path.write_text(idx)


def main() -> int:
    # 1. Wait for both ngrok tunnels.
    def both_tunnels_up() -> bool:
        t = fetch_tunnels()
        return TUNNEL_API_NAME in t and TUNNEL_GELF_NAME in t

    wait_for("ngrok tunnels", both_tunnels_up, tries=60, delay=2.0)
    tunnels = fetch_tunnels()
    api_url  = tunnels[TUNNEL_API_NAME].rstrip("/")
    gelf_url = tunnels[TUNNEL_GELF_NAME].rstrip("/")
    gelf_endpoint = f"{gelf_url}/gelf"

    # 2. Wait for Graylog REST API.
    def graylog_up() -> bool:
        status, _ = http_get(
            f"{GRAYLOG_BASE}/api/system/lbstatus",
            headers={"Authorization": basic_auth(ADMIN_USER, ADMIN_PW), "X-Requested-By": "bookmarklet-sync"},
            timeout=5.0,
        )
        return status == 200

    wait_for("Graylog API", graylog_up, tries=180, delay=2.0)

    # 3. Mint / fetch the API token.
    token = get_graylog_token()

    # 4. Rewrite the bookmarklet + index.html in the mounted repo.
    rewrite_bookmarklet(gelf_endpoint, token)

    # 5. Summary.
    print(
        "\n"
        "=====================================================\n"
        " TokScrape / Graylog is up.\n"
        " Paste these into the mobile app Settings screen:\n"
        "=====================================================\n"
        f"  Graylog URL:    {api_url}\n"
        f"  API token:      {token}\n"
        "  Lucene query:   host:tiktok-bookmarklet\n"
        "=====================================================\n"
        "\n"
        "Bookmarklet (GELF HTTP via ngrok):\n"
        f"  GELF endpoint:  {gelf_endpoint}\n"
        "  Bookmarklet:    updated (index.html + bookmarklet-src.js)\n"
        "    open index.html and re-drag the \"Log Key Metrics\" link.\n"
        "\n"
        "Local URLs (for your laptop / LAN):\n"
        f"  Web UI + API:   http://localhost:9000   (login {ADMIN_USER} / {ADMIN_PW})\n"
        "  GELF HTTP in:   http://localhost:12202/gelf\n"
        "\n"
        "Tear down:      docker compose down\n"
        "Wipe data:      docker compose down -v\n",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
