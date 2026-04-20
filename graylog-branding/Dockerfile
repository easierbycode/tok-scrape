# Custom Graylog Open image with the LP "tok-scrape" branding baked in.
#
# What this overlays on top of graylog/graylog:7.0.6
#   - /usr/share/graylog/graylog2-web-interface/assets/lp-logo.svg
#   - /usr/share/graylog/graylog2-web-interface/assets/branding-patch.js
#   - The bundled favicons (favicon.png + favicon.ico in the web interface
#     root), replaced with the LP versions.
#   - The HTML template (embedded in graylog.jar on 7.x) patched to include:
#       <link rel="icon" type="image/png" href="/assets/favicon.png">
#       <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
#       <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon-192.png">
#       <script src="/assets/branding-patch.js" defer></script>
#
# Notes:
#   - Graylog Open ships its web bundle under
#     /usr/share/graylog/graylog2-web-interface. Anything inside the
#     `assets/` subfolder is served at /assets/<file>.
#   - Graylog 7.x no longer has a static index.html — the HTML template is
#     embedded inside graylog.jar. inject-branding.sh extracts it from the
#     JAR, patches it, and puts it back. Falls back to patching a static
#     index.html if one exists (for forward/backward compatibility).
#
# Build & run (from the repo root):
#   docker compose build graylog
#   docker compose up -d graylog
#
# Verify:
#   curl -sI http://localhost:9000/assets/lp-logo.svg | head -1   # 200 OK
#   curl -sI http://localhost:9000/assets/branding-patch.js | head -1
#   open http://localhost:9000/  (favicon + login + nav logo should be LP)

# ---------------------------------------------------------------------------
# Stage 1: fetch `zip`/`unzip` from a clean ubuntu:noble image.
#
# The graylog/graylog:7.0.6 image is based on Ubuntu Noble but ships with
# /etc/apt/sources.list.d/ wiped, so `apt-get install unzip` in the final
# image fails with "Unable to locate package unzip". Grabbing the binaries
# from a clean Noble image side-steps the problem entirely.
# ---------------------------------------------------------------------------
FROM ubuntu:noble AS tools
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends zip unzip; \
    mkdir -p /opt/tools/bin /opt/tools/lib; \
    cp /usr/bin/unzip /opt/tools/bin/unzip; \
    cp /usr/bin/zip /opt/tools/bin/zip; \
    libbz2="$(ldconfig -p | awk '/libbz2\.so\.1\.0/{print $NF; exit}')"; \
    test -n "$libbz2"; \
    cp -L "$libbz2" /opt/tools/lib/libbz2.so.1.0; \
    rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Stage 2: the actual branded Graylog image.
# ---------------------------------------------------------------------------
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

# Bring in `unzip` + `zip` from the tools stage - `unzip` extracts the HTML
# template from graylog.jar, `zip -u` writes the patched template back in.
# libbz2 is a runtime dep of both binaries and isn't present in the slim
# graylog image. Copy it via /tmp, then place it in the detected multiarch
# library directory so this works on both x86_64 and arm64.
COPY --from=tools /opt/tools/bin/unzip        /usr/bin/unzip
COPY --from=tools /opt/tools/bin/zip          /usr/bin/zip
COPY --from=tools /opt/tools/lib/libbz2.so.1.0 /tmp/libbz2.so.1.0
RUN set -eux; \
    libdir=""; \
    for d in /lib/*-linux-gnu /usr/lib/*-linux-gnu; do \
        if [ -d "$d" ]; then \
            libdir="$d"; \
            break; \
        fi; \
    done; \
    if [ -z "$libdir" ]; then \
        libdir=/usr/lib; \
    fi; \
    cp /tmp/libbz2.so.1.0 "$libdir/libbz2.so.1.0"; \
    rm /tmp/libbz2.so.1.0

# Inject favicon links + branding-patch.js into the HTML template.
COPY inject-branding.sh /tmp/inject-branding.sh
RUN chmod +x /tmp/inject-branding.sh && /tmp/inject-branding.sh "${WEB_ROOT}" && rm /tmp/inject-branding.sh

# Drop back to the image's default user (graylog runs as uid 1100).
USER graylog
