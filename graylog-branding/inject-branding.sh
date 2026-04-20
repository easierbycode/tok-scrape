#!/bin/bash
# inject-branding.sh — Patch Graylog's HTML shell with LP favicon links and
# the branding-patch.js script tag.
#
# Called from the Dockerfile:  ./inject-branding.sh <WEB_ROOT>
#
# Graylog 7.x no longer ships a static index.html — the HTML template is
# embedded inside graylog.jar. This script handles both layouts:
#   - Legacy (≤6.x): patches <WEB_ROOT>/index.html directly.
#   - Modern (7.x+): extracts the HTML from graylog.jar, patches it, replaces it.

set -euo pipefail

WEB_ROOT="${1:?Usage: inject-branding.sh <WEB_ROOT>}"

SNIPPET='<link rel="icon" type="image/png" href="/assets/favicon.png"/><link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png"/><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"/><link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png"/><link rel="shortcut icon" href="/assets/favicon.ico"/><script src="/assets/branding-patch.js" defer></script>'

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

  # Strip existing favicon <link> tags.
  sed -i 's|<link[^>]*rel="\{0,1\}icon"\{0,1\}[^>]*>||gI' "$f" 2>/dev/null || true
  sed -i 's|<link[^>]*rel="\{0,1\}shortcut icon"\{0,1\}[^>]*>||gI' "$f" 2>/dev/null || true

  local injected=false

  if grep -qi '</head>' "$f"; then
    sed -i "s|</[hH][eE][aA][dD]>|${SNIPPET}</head>|" "$f"
    injected=true; echo ">>> Injected before </head>."
  fi

  if [ "$injected" = false ] && grep -qi '</body>' "$f"; then
    sed -i "s|</[bB][oO][dD][yY]>|${SNIPPET}</body>|" "$f"
    injected=true; echo ">>> Injected before </body>."
  fi

  if [ "$injected" = false ]; then
    echo "$SNIPPET" >> "$f"
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
# 3. Find the HTML template inside the JAR
# ===================================================================
echo ">>> Listing JAR contents..."
JAR_LISTING=$(jar_list "$GRAYLOG_JAR")
TOTAL=$(echo "$JAR_LISTING" | grep -c '.' || true)
echo ">>> JAR has ${TOTAL} entries."

TEMPLATE_PATH=""
# Try specific names first, then any .html
for pattern in '^.*index\.html$' '^.*index\.htm$' '\.html$'; do
  match=$(echo "$JAR_LISTING" | grep -iE "$pattern" | head -1 || true)
  if [ -n "$match" ]; then
    TEMPLATE_PATH="$match"
    break
  fi
done

if [ -z "$TEMPLATE_PATH" ]; then
  echo "=== DIAGNOSTICS ==="
  echo "HTML-ish entries:"
  echo "$JAR_LISTING" | grep -iE '\.(html|htm|template|ftl|mustache|thymeleaf)' | head -20 || echo "(none)"
  echo "---"
  echo "Sample entries (first 40):"
  echo "$JAR_LISTING" | head -40
  echo "=== END DIAGNOSTICS ==="
  echo "FATAL: no HTML template in JAR" >&2
  exit 1
fi

echo ">>> Template: ${TEMPLATE_PATH}"

# ===================================================================
# 4. Extract → patch → replace
# ===================================================================
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

jar_extract "$GRAYLOG_JAR" "$TEMPLATE_PATH" "$TMPDIR"

EXTRACTED="${TMPDIR}/${TEMPLATE_PATH}"
if [ ! -f "$EXTRACTED" ]; then
  echo "FATAL: extraction failed — file not at ${EXTRACTED}" >&2
  find "$TMPDIR" -type f >&2
  exit 1
fi

patch_html "$EXTRACTED"
jar_update "$GRAYLOG_JAR" "$TEMPLATE_PATH" "$TMPDIR"

echo ">>> Branding injection complete."
