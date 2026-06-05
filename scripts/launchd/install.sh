#!/usr/bin/env bash
# install.sh — install scripts/network-devices --notify as a macOS LaunchDaemon.
#
# Runs the offline-peer monitor every 60s (as the invoking user), surviving
# reboots without requiring login. The Discord webhook lives in a chmod-600 env
# file (~/.config/network-devices.env), NOT in the world-readable plist.
#
# Usage:
#   sudo scripts/launchd/install.sh            # install / reinstall + start
#   sudo scripts/launchd/install.sh --uninstall
#        scripts/launchd/install.sh --dry-run  # print the plist it would write
set -euo pipefail

LABEL="com.easierbycode.network-devices"
PLIST_DST="/Library/LaunchDaemons/${LABEL}.plist"

MODE="${1:-install}"
case "$MODE" in
  install|--dry-run|--uninstall) ;;
  *) echo "install.sh: unknown argument '$MODE' (install | --dry-run | --uninstall)" >&2; exit 2 ;;
esac

if [ "$MODE" = "--uninstall" ]; then
  [ "$(id -u)" -eq 0 ] || { echo "install.sh: --uninstall must run as root — try: sudo $0 --uninstall" >&2; exit 1; }
  launchctl bootout "system/${LABEL}" 2>/dev/null || true
  rm -f "$PLIST_DST"
  echo "Uninstalled ${LABEL} (left ~/.config/network-devices.env, state, and logs in place)."
  exit 0
fi

# Resolve the real target user/home (works under sudo via SUDO_USER, or as the
# plain user for --dry-run).
TARGET_USER="${SUDO_USER:-$USER}"
if [ "$TARGET_USER" = "root" ]; then
  echo "install.sh: could not determine a non-root target user (run via 'sudo', not as root)." >&2
  exit 1
fi
TARGET_HOME="$(/usr/bin/dscl . -read "/Users/${TARGET_USER}" NFSHomeDirectory | awk '{print $2}')"
[ -n "$TARGET_HOME" ] || { echo "install.sh: could not resolve home for ${TARGET_USER}" >&2; exit 1; }

# Locate the repo + the script the plist will run.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
NETDEV="${REPO_ROOT}/scripts/network-devices"
[ -x "$NETDEV" ] || { echo "install.sh: ${NETDEV} not found or not executable" >&2; exit 1; }

ENV_EXAMPLE="${SCRIPT_DIR}/network-devices.env.example"
ENV_DST="${TARGET_HOME}/.config/network-devices.env"
LOG="${TARGET_HOME}/Library/Logs/network-devices.log"

# Single source of truth for the plist. All paths absolute; HOME is set so the
# script's default state path (~/.local/state/...) resolves under launchd.
gen_plist() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>${LABEL}</string>
  <key>UserName</key>         <string>${TARGET_USER}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>set -a; . "${ENV_DST}"; exec "${NETDEV}" --notify</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>  <string>/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>  <string>${TARGET_HOME}</string>
  </dict>
  <key>RunAtLoad</key>        <true/>
  <key>StartInterval</key>    <integer>60</integer>
  <key>StandardOutPath</key>  <string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict>
</plist>
EOF
}

if [ "$MODE" = "--dry-run" ]; then
  gen_plist
  exit 0
fi

# ---- install (requires root) ----
[ "$(id -u)" -eq 0 ] || { echo "install.sh: must run as root — try: sudo $0" >&2; exit 1; }

# User-owned dirs.
install -d -o "$TARGET_USER" "${TARGET_HOME}/.config" "${TARGET_HOME}/Library/Logs"

# Seed the secret file if absent (never overwrite an existing one).
if [ ! -f "$ENV_DST" ]; then
  cp "$ENV_EXAMPLE" "$ENV_DST"
  chown "$TARGET_USER" "$ENV_DST"
  chmod 600 "$ENV_DST"
  echo ">> Created ${ENV_DST} — edit it and set DISCORD_WEBHOOK_URL."
fi

gen_plist > "$PLIST_DST"
chown root:wheel "$PLIST_DST"
chmod 644 "$PLIST_DST"

# (Re)load cleanly.
launchctl bootout "system/${LABEL}" 2>/dev/null || true
launchctl bootstrap system "$PLIST_DST"
launchctl enable "system/${LABEL}"
launchctl kickstart -k "system/${LABEL}"

echo ">> Installed ${LABEL}"
echo "   plist: ${PLIST_DST}"
echo "   runs : ${NETDEV} --notify  (every 60s, as ${TARGET_USER})"
echo "   log  : ${LOG}"
if grep -qE '^DISCORD_WEBHOOK_URL=.+' "$ENV_DST"; then
  echo "   webhook: set ✓"
else
  echo "   webhook: NOT set — add DISCORD_WEBHOOK_URL to ${ENV_DST} (alerts won't fire until you do)."
fi
echo "   status : sudo launchctl print system/${LABEL}"
