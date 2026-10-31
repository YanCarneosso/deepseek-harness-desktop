#!/usr/bin/env bash
# Removes deepseek-harness-desktop for the current user.
#
# Usage: ./uninstall.sh [--remove-dsh] [--purge]
#   --remove-dsh  also remove the dsh CLI in ~/.local/lib/dsh
#   --purge       also remove launcher preferences and state (window profiles, logs)
#
# Never touches ~/.dsh (your dsh sessions, profiles and credentials) or project .dsh/ folders.
set -euo pipefail

BINDIR="$HOME/.local/bin"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/deepseek-harness-desktop"
STATE="${XDG_STATE_HOME:-$HOME/.local/state}/deepseek-harness-desktop"

remove_dsh=0 purge=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove-dsh) remove_dsh=1 ;;
    --purge) purge=1 ;;
    -h | --help) sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "uninstall.sh: unknown option $1" >&2; exit 1 ;;
  esac
  shift
done

[[ -x "$BINDIR/deepseek-harness" ]] && "$BINDIR/deepseek-harness" stop --all || true

if command -v code > /dev/null; then
  code --uninstall-extension deepseek-harness-desktop.deepseek-harness 2> /dev/null || true
fi

# Only remove links that point to this project, so an unrelated dsh install is left alone.
for name in deepseek-harness dsh; do
  target="$(readlink "$BINDIR/$name" 2> /dev/null || true)"
  case "$target" in
    *deepseek-harness-desktop*) rm -f "$BINDIR/$name" ;;
  esac
done

rm -rf "$DATA/deepseek-harness-desktop"
rm -f "$DATA/applications/deepseek-harness-desktop.desktop" \
  "$DATA/icons/hicolor/scalable/apps/deepseek-harness-desktop.svg"
update-desktop-database "$DATA/applications" 2> /dev/null || true

[[ "$remove_dsh" == 1 ]] && rm -rf "$HOME/.local/lib/dsh"
[[ "$purge" == 1 ]] && rm -rf "$CONFIG" "$STATE"

echo "✓ deepseek-harness-desktop removed. ~/.dsh was kept."
