# Custom Graylog Open image with the LP "tok-scrape" branding baked in.
#
# What this overlays on top of graylog/graylog:7.0.6
#   - /usr/share/graylog/graylog2-web-interface/assets/lp-logo.svg
#   - /usr/share/graylog/graylog2-web-interface/assets/branding-patch.js
#   - The bundled favicons (favicon.png + favicon.ico in the web interface
#     root), replaced with the LP versions.
#   - index.html patched in-place to include:
#       <link rel="icon" type="image/png" href="/assets/favicon.png">
#       <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
#       <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
#       <script src="/assets/branding-patch.js" defer></script>
#
# Notes:
#   - Graylog Open ships its web bundle under
#     /usr/share/graylog/graylog2-web-interface. Anything inside the
#     `assets/` subfolder is served at /assets/<file>.
#   - We use sed against index.html. If a future Graylog version renames or
#     restructures the file the build will fail loudly here — fix the sed
#     expression and rebuild.
#
# Build & run (from the repo root):
#   docker compose build graylog
#   docker compose up -d graylog
#
# Verify:
#   curl -sI http://localhost:9000/assets/lp-logo.svg | head -1   # 200 OK
#   curl -sI http://localhost:9000/assets/branding-patch.js | head -1
#   open http://localhost:9000/  (favicon + login + nav logo should be LP)

FROM graylog/graylog:7.0.6

# Run the file ops as root, then drop back to the image's default user.
USER root

ARG WEB_ROOT=/usr/share/graylog/graylog2-web-interface
ARG ASSETS=/usr/share/graylog/graylog2-web-interface/assets

# Copy LP assets into the served /assets/ path.
COPY lp-logo.svg        ${ASSETS}/lp-logo.svg
COPY lp-logo-512.png    ${ASSETS}/lp-logo-512.png
COPY favicon.png        ${ASSETS}/favicon.png
COPY favicon-16.png     ${ASSETS}/favicon-16.png
COPY favicon-32.png     ${ASSETS}/favicon-32.png
COPY favicon-192.png    ${ASSETS}/favicon-192.png
COPY favicon.ico        ${ASSETS}/favicon.ico
COPY branding-patch.js  ${ASSETS}/branding-patch.js

# Replace bundled favicons at the web-root level (Graylog references a few of
# these directly outside the /assets/ path on certain versions). The `|| true`
# guards against an upstream layout change so the build doesn't fail just
# because one of these paths is missing.
RUN set -eux; \
    cp ${ASSETS}/favicon.png ${WEB_ROOT}/favicon.png || true; \
    cp ${ASSETS}/favicon.ico ${WEB_ROOT}/favicon.ico || true

# Inject favicon links + branding-patch.js into index.html. Idempotent: the sed
# expressions are no-ops if the markers are already present (e.g. a re-run of
# the Docker layer after a base-image change).
RUN set -eux; \
    INDEX="${WEB_ROOT}/index.html"; \
    test -f "$INDEX"; \
    # Drop existing <link rel="icon" ...> tags so ours win.
    sed -i 's|<link[^>]*rel="\?icon"\?[^>]*>||g' "$INDEX"; \
    sed -i 's|<link[^>]*rel="\?shortcut icon"\?[^>]*>||g' "$INDEX"; \
    # Inject our favicon links + branding-patch.js right before </head>.
    if ! grep -q "branding-patch.js" "$INDEX"; then \
      sed -i 's|</head>|<link rel="icon" type="image/png" href="/assets/favicon.png"/><link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16.png"/><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"/><link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png"/><link rel="shortcut icon" href="/assets/favicon.ico"/><script src="/assets/branding-patch.js" defer></script></head>|' "$INDEX"; \
    fi; \
    grep -q "branding-patch.js" "$INDEX"; \
    grep -q "/assets/favicon.png" "$INDEX"

# Drop back to the image's default user (graylog runs as uid 1100).
USER graylog
