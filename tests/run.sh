#!/usr/bin/env bash
# Offline tests for the launcher. No network, no real dsh or browser: both are stubbed in tests/fakes.
# Everything runs inside a throwaway HOME, so the real installation is never touched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCHER="$ROOT/bin/deepseek-harness"
TMP="$(mktemp -d)"

export HOME="$TMP/home"
export XDG_CONFIG_HOME="$HOME/.config" XDG_STATE_HOME="$HOME/.local/state" DSH_HOME="$HOME/.dsh"
export DSH_DESKTOP_DSH_BIN="$ROOT/tests/fakes/dsh" DSH_DESKTOP_BROWSER="$ROOT/tests/fakes/browser"
export DSH_DESKTOP_FIRST_PORT=$((40000 + RANDOM % 20000)) DSH_DESKTOP_START_TIMEOUT=10
export DSH_DESKTOP_CLIENT=test FAKE_DSH_LOG="$TMP/dsh.log" FAKE_BROWSER_LOG="$TMP/browser.log"
WS="$TMP/my project"
mkdir -p "$HOME" "$WS"

cleanup() {
  "$LAUNCHER" stop --all > /dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

passed=0 failed=0
ok() { passed=$((passed + 1)); printf '  ok    %s\n' "$1"; }
not_ok() { failed=$((failed + 1)); printf '  FAIL  %s\n' "$1"; }
check() {
  local name="$1"; shift
  if "$@"; then ok "$name"; else not_ok "$name"; fi
}
wait_until() {
  for _ in $(seq 1 40); do "$@" 2> /dev/null && return 0; sleep 0.25; done
  return 1
}
is_stopped() { ! "$LAUNCHER" status --dir "$WS" > /dev/null 2>&1; }
is_running() { "$LAUNCHER" status --dir "$WS" > /dev/null 2>&1; }

echo "launcher tests"

check "version prints the project name" bash -c '"$0" version | grep -q "deepseek-harness-desktop"' "$LAUNCHER"
check "help exits 0" bash -c '"$0" help > /dev/null' "$LAUNCHER"
check "unknown option exits non-zero" bash -c '! "$0" start --bogus > /dev/null' "$LAUNCHER"

global="$("$LAUNCHER" config global)"
check "config global creates the home patch" test -f "$DSH_HOME/cordis.patch.yml" -a "$global" = "$DSH_HOME/cordis.patch.yml"
check "global patch is an empty YAML list" bash -c 'tail -1 "$0" | grep -qx "\[\]"' "$global"
echo "# edited" >> "$global"
"$LAUNCHER" config global > /dev/null
check "config global keeps an existing file" grep -q "# edited" "$global"

"$LAUNCHER" config local --dir "$WS" > /dev/null
check "config local works in a path with spaces" test -f "$WS/.dsh/cordis.patch.yml"

check "status reports stopped (exit 3)" bash -c '"$0" status --dir "$1" > /dev/null; test $? -eq 3' "$LAUNCHER" "$WS"

url="$("$LAUNCHER" start --dir "$WS" --no-open --print-url)"
check "start prints the authenticated URL" test "$url" = "http://127.0.0.1:$DSH_DESKTOP_FIRST_PORT/?token=fake-token"
check "status reports running" is_running
check "dsh receives the local patch" grep -q -- "--patch $WS/.dsh/cordis.patch.yml" "$FAKE_DSH_LOG"
check "dsh receives the app host as trusted host" grep -q -- "--trusted-host dsh.localhost" "$FAKE_DSH_LOG"

again="$("$LAUNCHER" start --dir "$WS" --no-open --print-url)"
check "second start reuses the running instance" test "$again" = "$url" -a "$(wc -l < "$FAKE_DSH_LOG")" -eq 1

check "config show runs dsh --dump-config" bash -c '"$0" config show --dir "$1" | grep -q "fake dump-config"' "$LAUNCHER" "$WS"

"$LAUNCHER" stop --dir "$WS" > /dev/null
check "stop stops the instance" is_stopped

"$LAUNCHER" start --dir "$WS" --app > /dev/null
check "app mode opens the window on the app host" \
  wait_until grep -q -- "--app=http://dsh.localhost:$DSH_DESKTOP_FIRST_PORT/" "$FAKE_BROWSER_LOG"
check "app mode uses an isolated profile" grep -q -- "--user-data-dir=$XDG_STATE_HOME/deepseek-harness-desktop/" "$FAKE_BROWSER_LOG"
check "closing the window stops the server it started" wait_until is_stopped

"$LAUNCHER" start --dir "$WS" --no-open > /dev/null
: > "$FAKE_BROWSER_LOG"
"$LAUNCHER" start --dir "$WS" --app > /dev/null
check "app mode reuses a running instance" wait_until grep -q -- "--app=" "$FAKE_BROWSER_LOG"
sleep 2
check "closing the window keeps an instance it did not start" is_running

"$LAUNCHER" stop --all > /dev/null
check "stop --all stops everything" bash -c '"$0" status --all > /dev/null; test $? -eq 3' "$LAUNCHER"

before="$(wc -l < "$FAKE_BROWSER_LOG")"
DSH_DESKTOP_BROWSER="$TMP/missing browser" "$LAUNCHER" start --dir "$WS" --app > /dev/null
sleep 1
check "a missing configured browser is never replaced by another one" \
  bash -c 'test "$(wc -l < "$0")" -eq "$1" && ! pgrep -f "user-data-dir=$2" > /dev/null' \
  "$FAKE_BROWSER_LOG" "$before" "$TMP"
"$LAUNCHER" stop --all > /dev/null

printf '\n%d passed, %d failed\n' "$passed" "$failed"
[[ "$failed" == 0 ]]
