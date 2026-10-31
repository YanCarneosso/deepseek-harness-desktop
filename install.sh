#!/usr/bin/env bash
# Installs deepseek-harness-desktop for the current user (no root required):
#   1. the pinned @deepseek-ai/dsh CLI in ~/.local/lib/dsh
#   2. the deepseek-harness launcher and dsh wrapper in ~/.local/bin
#   3. launcher preferences (only when missing)
#   4. the application menu entry and icon
#   5. the VS Code extension (when `code` is available)
#
# Usage: ./install.sh [--dsh-version VERSION] [--dev] [--skip-dsh] [--skip-vscode]
#   --dev          link the launcher to this checkout instead of copying it (for contributors)
#   --skip-dsh     keep the dsh CLI that is already installed
#   --skip-vscode  do not install the VS Code extension
set -euo pipefail

DSH_VERSION="0.2.1-rc.5"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINDIR="$HOME/.local/bin"
LIBDIR="$HOME/.local/lib/dsh"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
SHAREDIR="$DATA/deepseek-harness-desktop"
PREFS="${XDG_CONFIG_HOME:-$HOME/.config}/deepseek-harness-desktop/launcher.env"
APP_HOST="dsh.localhost"

dev=0 skip_dsh=0 skip_vscode=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dsh-version) DSH_VERSION="${2:?--dsh-version needs a value}"; shift ;;
    --dev) dev=1 ;;
    --skip-dsh) skip_dsh=1 ;;
    --skip-vscode) skip_vscode=1 ;;
    -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install.sh: unknown option $1" >&2; exit 1 ;;
  esac
  shift
done

step() { printf '\n› %s\n' "$*"; }

for tool in node npm setsid; do
  command -v "$tool" > /dev/null || { echo "install.sh: '$tool' is required." >&2; exit 1; }
done

if [[ "$skip_dsh" == 0 ]]; then
  step "Installing @deepseek-ai/dsh@$DSH_VERSION into $LIBDIR"
  mkdir -p "$LIBDIR"
  npm install --prefix "$LIBDIR" --no-fund --no-audit --save-exact "@deepseek-ai/dsh@$DSH_VERSION"
fi

step "Installing commands into $BINDIR"
mkdir -p "$BINDIR"
if [[ "$dev" == 1 ]]; then
  ln -sfn "$ROOT/bin/deepseek-harness" "$BINDIR/deepseek-harness"
  ln -sfn "$ROOT/bin/dsh" "$BINDIR/dsh"
else
  install -Dm755 "$ROOT/bin/deepseek-harness" "$SHAREDIR/bin/deepseek-harness"
  install -Dm755 "$ROOT/bin/dsh" "$SHAREDIR/bin/dsh"
  ln -sfn "$SHAREDIR/bin/deepseek-harness" "$BINDIR/deepseek-harness"
  ln -sfn "$SHAREDIR/bin/dsh" "$BINDIR/dsh"
fi
[[ ":$PATH:" == *":$BINDIR:"* ]] || echo "  note: $BINDIR is not on your PATH."
"$BINDIR/dsh" --version || echo "  note: dsh is not installed yet (run without --skip-dsh)."

step "Launcher preferences"
if [[ -f "$PREFS" ]]; then
  echo "  kept $PREFS"
else
  install -Dm644 "$ROOT/share/launcher.env.example" "$PREFS"
  echo "  created $PREFS"
fi

step "Application menu entry"
install -Dm644 "$ROOT/share/deepseek-harness-desktop.svg" \
  "$DATA/icons/hicolor/scalable/apps/deepseek-harness-desktop.svg"
mkdir -p "$DATA/applications"
sed -e "s|@BINDIR@|$BINDIR|g" -e "s|@APP_HOST@|$APP_HOST|g" \
  "$ROOT/share/deepseek-harness-desktop.desktop.in" > "$DATA/applications/deepseek-harness-desktop.desktop"
update-desktop-database "$DATA/applications" 2> /dev/null || true
command -v kbuildsycoca6 > /dev/null && kbuildsycoca6 > /dev/null 2>&1 || true

if [[ "$skip_vscode" == 0 ]]; then
  step "VS Code extension"
  if command -v code > /dev/null; then
    vsix="$(mktemp -d)/deepseek-harness-desktop.vsix"
    python3 -I "$ROOT/vscode-extension/scripts/pack_vsix.py" "$vsix"
    code --install-extension "$vsix" --force
    rm -rf "$(dirname "$vsix")"
  else
    echo "  'code' not found; skipped."
  fi
fi

cat << EOF

✓ Done. Open "DeepSeek Harness" from the application menu, or run: deepseek-harness start
  In VS Code, reload the window (Developer: Reload Window) and click "DeepSeek" in the status bar.
EOF
