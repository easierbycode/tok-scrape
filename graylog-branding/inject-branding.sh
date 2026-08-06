#!/bin/bash
# inject-branding.sh — Patch Graylog's HTML shell with LP favicon links,
# the branding-theme.css stylesheet link, and the branding-patch.js script tag.
#
# Called from the Dockerfile:  ./inject-branding.sh <WEB_ROOT>
#
# Graylog 7.x no longer ships a static index.html — the HTML template is
# embedded inside graylog.jar. This script handles both layouts:
#   - Legacy (≤6.x): patches <WEB_ROOT>/index.html directly.
#   - Modern (7.x+): extracts the HTML from graylog.jar, patches it, replaces it.

set -euo pipefail

WEB_ROOT="${1:?Usage: inject-branding.sh <WEB_ROOT>}"

# Plain snippet (static HTML — Graylog ≤6.x or non-templated assets/index.html).
SNIPPET='<link rel="icon" type="image/png" href="/assets/favicon.png"/><link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png"/><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"/><link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png"/><link rel="shortcut icon" href="/assets/favicon.ico"/><link rel="stylesheet" href="/assets/branding-theme.css"/><script src="/assets/branding-patch.js" defer></script>'

# Nonce-aware snippet for Graylog 7.x templates that interpolate ${nonce}
# into every <script>/<link> the JVM emits. The CSP set by Graylog enforces
# nonce-based script execution, so a plain <script> tag is blocked.
SNIPPET_TEMPLATE='<link rel="icon" type="image/png" href="${appPrefix}assets/favicon.png"/><link rel="icon" type="image/png" sizes="16x16" href="${appPrefix}assets/favicon-16.png"/><link rel="icon" type="image/png" sizes="32x32" href="${appPrefix}assets/favicon-32.png"/><link rel="icon" type="image/png" sizes="192x192" href="${appPrefix}assets/favicon-192.png"/><link rel="shortcut icon" href="${appPrefix}assets/favicon.ico"/><link rel="stylesheet" href="${appPrefix}assets/branding-theme.css"/><script nonce="${nonce}" src="${appPrefix}assets/branding-patch.js" defer></script>'

# JAR entries Graylog 7.x renders for the main web app. Order matters — the
# .template variants are what /<-> actually serves; assets/index.html is a
# fallback some Graylog versions use.
TEMPLATE_ENTRIES=(
  'web-interface/index.html.template'
  'web-interface/index.html.development.template'
  'web-interface/assets/index.html'
)

# ---------------------------------------------------------------------------
# patch_html FILE
# ---------------------------------------------------------------------------
patch_html() {
  local f="$1"
  echo ">>> Patching: $f ($(wc -c < "$f") bytes)"

  if grep -q "branding-patch.js" "$f"; then
    echo ">>> Already patched — skipping."
    return 0
  fi

  # Pick the snippet variant — templated files contain ${nonce} placeholders
  # that Graylog's JVM-side renderer fills in. We inject the same placeholder
  # so our <script> tag passes the strict CSP.
  local snippet="$SNIPPET"
  if grep -q '${nonce}' "$f" || grep -q '${appPrefix}' "$f"; then
    snippet="$SNIPPET_TEMPLATE"
    echo ">>> Detected template placeholders — using nonce-aware snippet."
  fi

  # Strip existing favicon <link> tags.
  sed -i 's|<link[^>]*rel="\{0,1\}icon"\{0,1\}[^>]*>||gI' "$f" 2>/dev/null || true
  sed -i 's|<link[^>]*rel="\{0,1\}shortcut icon"\{0,1\}[^>]*>||gI' "$f" 2>/dev/null || true

  local injected=false

  # Use a sed delimiter that won't clash with `/` in URLs or `${...}` in templates.
  if grep -qi '</head>' "$f"; then
    sed -i "s|</[hH][eE][aA][dD]>|${snippet}</head>|" "$f"
    injected=true; echo ">>> Injected before </head>."
  fi

  if [ "$injected" = false ] && grep -qi '</body>' "$f"; then
    sed -i "s|</[bB][oO][dD][yY]>|${snippet}</body>|" "$f"
    injected=true; echo ">>> Injected before </body>."
  fi

  if [ "$injected" = false ]; then
    echo "$snippet" >> "$f"
    injected=true; echo ">>> Appended to end of file."
  fi

  grep -q "branding-patch.js" "$f" || { echo "FAIL: verification failed" >&2; return 1; }
  echo ">>> OK."
}

# ---------------------------------------------------------------------------
# jar_list FILE — list entries in a ZIP/JAR using whatever tool is available
# ---------------------------------------------------------------------------
jar_list() {
  local jarfile="$1"
  if command -v unzip >/dev/null 2>&1; then
    unzip -l "$jarfile" 2>/dev/null | awk 'NR>3 && /^ *[0-9]/{print $NF}'
    return
  fi
  if command -v jar >/dev/null 2>&1; then
    jar tf "$jarfile" 2>/dev/null
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import zipfile, sys
with zipfile.ZipFile(sys.argv[1]) as z:
    for n in z.namelist():
        print(n)
" "$jarfile" 2>/dev/null
    return
  fi
  echo "ERROR: no tool available to list JAR contents (tried unzip, jar, python3)" >&2
  return 1
}

# ---------------------------------------------------------------------------
# jar_extract JARFILE ENTRY DESTDIR — extract a single entry
# ---------------------------------------------------------------------------
jar_extract() {
  local jarfile="$1" entry="$2" destdir="$3"
  if command -v unzip >/dev/null 2>&1; then
    unzip -o "$jarfile" "$entry" -d "$destdir" 2>/dev/null
    return
  fi
  if command -v jar >/dev/null 2>&1; then
    (cd "$destdir" && jar xf "$jarfile" "$entry" 2>/dev/null)
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import zipfile, sys, os
with zipfile.ZipFile(sys.argv[1]) as z:
    z.extract(sys.argv[2], sys.argv[3])
" "$jarfile" "$entry" "$destdir" 2>/dev/null
    return
  fi
  echo "ERROR: no tool available to extract from JAR" >&2
  return 1
}

# ---------------------------------------------------------------------------
# jar_update JARFILE ENTRY BASEDIR — replace a single entry in the JAR
# ---------------------------------------------------------------------------
jar_update() {
  local jarfile="$1" entry="$2" basedir="$3"
  if command -v jar >/dev/null 2>&1; then
    (cd "$basedir" && jar uf "$jarfile" "$entry" 2>/dev/null)
    return
  fi
  if command -v zip >/dev/null 2>&1; then
    (cd "$basedir" && zip -u "$jarfile" "$entry" 2>/dev/null)
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
import zipfile, sys, os, shutil, tempfile
jarfile, entry, basedir = sys.argv[1], sys.argv[2], sys.argv[3]
srcfile = os.path.join(basedir, entry)
tmpfd, tmpname = tempfile.mkstemp(suffix='.jar')
os.close(tmpfd)
with zipfile.ZipFile(jarfile, 'r') as zin, zipfile.ZipFile(tmpname, 'w') as zout:
    for item in zin.infolist():
        if item.filename == entry:
            zout.write(srcfile, entry)
        else:
            zout.writestr(item, zin.read(item.filename))
shutil.move(tmpname, jarfile)
" "$jarfile" "$entry" "$basedir" 2>/dev/null
    return
  fi
  echo "ERROR: no tool available to update JAR (tried jar, zip, python3)" >&2
  return 1
}

# ===================================================================
# 1. Try static HTML (Graylog ≤6.x or custom)
# ===================================================================
for candidate in "${WEB_ROOT}/index.html" "${WEB_ROOT}/index.htm"; do
  if [ -f "$candidate" ]; then
    patch_html "$candidate"
    exit 0
  fi
done
LEGACY_HTML=$(find "$WEB_ROOT" -maxdepth 1 -name '*.html' -print -quit 2>/dev/null || true)
if [ -n "$LEGACY_HTML" ] && [ -f "$LEGACY_HTML" ]; then
  patch_html "$LEGACY_HTML"
  exit 0
fi

echo ">>> No static HTML in ${WEB_ROOT} — looking for JAR-embedded template."

# ===================================================================
# 2. Find the Graylog JAR
# ===================================================================
GRAYLOG_JAR=""
for jpath in \
    /usr/share/graylog/graylog.jar \
    /usr/share/graylog/graylog-server.jar \
    /opt/graylog/graylog.jar; do
  [ -f "$jpath" ] && GRAYLOG_JAR="$jpath" && break
done
if [ -z "$GRAYLOG_JAR" ]; then
  GRAYLOG_JAR=$(find /usr/share /opt -maxdepth 4 -name 'graylog*.jar' -not -name '*original*' -print -quit 2>/dev/null || true)
fi
if [ -z "$GRAYLOG_JAR" ] || [ ! -f "$GRAYLOG_JAR" ]; then
  echo "FATAL: no graylog JAR found" >&2
  ls -laR /usr/share/graylog/ 2>/dev/null | head -30 >&2 || true
  exit 1
fi
echo ">>> JAR: ${GRAYLOG_JAR} ($(du -h "$GRAYLOG_JAR" | cut -f1))"

# ===================================================================
# 3. Locate the HTML templates inside the JAR
# ===================================================================
echo ">>> Listing JAR contents..."
JAR_LISTING=$(jar_list "$GRAYLOG_JAR")
TOTAL=$(echo "$JAR_LISTING" | grep -c '.' || true)
echo ">>> JAR has ${TOTAL} entries."

# Build the list of templates to patch. Prefer the known web-interface
# entries — these are what / actually serves. Fall back to discovery only if
# the layout has shifted in a future Graylog version.
#
# NOTE: we use herestrings (`<<<`) instead of `echo "$X" | grep` because
# `set -o pipefail` + `grep -q` interact badly: grep -q closes the pipe on
# first match, the upstream echo gets SIGPIPE, and pipefail makes the whole
# pipeline return non-zero — silently turning matches into "no match".
TEMPLATES_TO_PATCH=()
for entry in "${TEMPLATE_ENTRIES[@]}"; do
  if grep -qxF "$entry" <<< "$JAR_LISTING"; then
    TEMPLATES_TO_PATCH+=("$entry")
  fi
done

if [ ${#TEMPLATES_TO_PATCH[@]} -eq 0 ]; then
  echo ">>> Known template paths missing — falling back to discovery."
  # Restrict fallback to genuine HTML — `web-interface/config.js.template`
  # also matches a careless `\.template$` regex and patching it as HTML
  # corrupts the JS config that bootstraps Graylog's web app.
  while IFS= read -r match; do
    [ -n "$match" ] && TEMPLATES_TO_PATCH+=("$match")
  done < <(grep -iE '^web-interface/.*(index\.html(\.[a-z]+)?\.template|index\.html|\.htm)$' <<< "$JAR_LISTING" || true)
fi

if [ ${#TEMPLATES_TO_PATCH[@]} -eq 0 ]; then
  echo "=== DIAGNOSTICS ==="
  echo "HTML-ish entries:"
  echo "$JAR_LISTING" | grep -iE '\.(html|htm|template|ftl|mustache|thymeleaf)' | head -20 || echo "(none)"
  echo "=== END DIAGNOSTICS ==="
  echo "FATAL: no web-interface template in JAR" >&2
  exit 1
fi

echo ">>> Templates to patch: ${TEMPLATES_TO_PATCH[*]}"

# ===================================================================
# 3b. Inject LP assets into the JAR's classpath under web-interface/assets/
# ===================================================================
# Graylog 7.x serves /assets/* from JAR resources rooted at web-interface/
# (see io.graylog... ClasspathBackedAssetServlet), NOT from the on-disk
# graylog2-web-interface/assets/ directory that the Dockerfile populates.
# Files we COPY into the disk path are silently shadowed by the JAR. Copy
# them into the JAR here so the URLs the branding-patch references actually
# resolve.
ASSETS_FS_DIR="${WEB_ROOT}/assets"
ASSET_FILES=(
  branding-patch.js
  branding-theme.css
  lp-logo.svg
  lp-logo-512.png
  favicon.png
  favicon-16.png
  favicon-32.png
  favicon-192.png
  favicon.ico
)

ASSET_STAGE=$(mktemp -d)
mkdir -p "$ASSET_STAGE/web-interface/assets"
for asset in "${ASSET_FILES[@]}"; do
  if [ -f "${ASSETS_FS_DIR}/${asset}" ]; then
    cp "${ASSETS_FS_DIR}/${asset}" "$ASSET_STAGE/web-interface/assets/${asset}"
    echo ">>> Staged JAR asset: web-interface/assets/${asset}"
  else
    echo ">>> Skipping missing asset: ${asset}"
  fi
done

# `zip -u` updates entries in-place. Run from the stage dir so the entry
# paths are stored as web-interface/assets/<file> (matches the classpath
# layout the servlet looks up).
(cd "$ASSET_STAGE" && zip -u "$GRAYLOG_JAR" web-interface/assets/* >/dev/null)
rm -rf "$ASSET_STAGE"

# ===================================================================
# 4. Extract → patch → replace each template
# ===================================================================
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

for entry in "${TEMPLATES_TO_PATCH[@]}"; do
  jar_extract "$GRAYLOG_JAR" "$entry" "$TMPDIR"
  EXTRACTED="${TMPDIR}/${entry}"
  if [ ! -f "$EXTRACTED" ]; then
    echo "FATAL: extraction failed — file not at ${EXTRACTED}" >&2
    find "$TMPDIR" -type f >&2
    exit 1
  fi
  patch_html "$EXTRACTED"
  jar_update "$GRAYLOG_JAR" "$entry" "$TMPDIR"
done

echo ">>> Branding injection complete."
