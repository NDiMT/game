#!/usr/bin/env bash
# EIDOLON one-command smoke test (target: under 10 minutes). Runs, in parallel:
#   1. the headless scripted playthrough (tests/playthrough.gd), retried ONCE on an engine crash
#      (known flake: "Caller thread can't call this function" / signal 11) and reported as a flake if the retry passes
#   2. the web smoke (tests/web_smoke.mjs: Playwright + SwiftShader, mobile 390x844 DPR 2) on the local export
#      build/web served by python3 -m http.server from /home/user/game, or on the live site with --live
# Prints a PASS/FAIL summary; exit 0 only when everything passes.
#
# Usage:  tests/smoke.sh [--live] [--web-only | --headless-only] [--ref <git-ref>] [--project <dir>] [--tier low|high] [--shot-scale css|device]
#   --live           web smoke against https://ndimt.github.io/game/eidolon-world/ (shots tagged smoke-live-*)
#   --ref <git-ref>  headless playthrough on a clean snapshot of that commit (git archive + the .godot import
#                    cache, in a temp dir), e.g. --ref 460853e (v0.8.4) or --ref HEAD, instead of the working tree
#   --project <dir>  headless playthrough on another project dir (default: this repo's working tree)
#   --tier <t>       quality tier for the web walk-through (default low; "high" is much slower under SwiftShader)
#   --shot-scale <s> css (default: 390x844 PNGs, fast) or device (780x1688 at DPR 2, slower)
# Outputs: dev/shots/<tag>-<room>.png, <tag>-console.log, <tag>-web.log, <tag>-playthrough[-retry].log
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"                       # .../eidolon-world
ROOT="$(cd "$REPO/.." && pwd)"                       # .../game (the http.server root)
GODOT="${GODOT:-/opt/godot/godot}"
NODE="${NODE:-node}"
LOCK=/home/user/game/realms/dev/.shotlock
LIVE_URL="https://ndimt.github.io/game/eidolon-world/index.html"
SHOTS="$REPO/dev/shots"
PT_TIMEOUT="${PT_TIMEOUT:-280}"                      # per headless attempt (a clean run takes ~170-200 s)

LIVE=0; RUN_PT=1; RUN_WEB=1; REF=""; PROJECT="$REPO"; TIER=low; SHOT_SCALE=css
while [ $# -gt 0 ]; do
  case "$1" in
    --live) LIVE=1 ;;
    --web-only) RUN_PT=0 ;;
    --headless-only) RUN_WEB=0 ;;
    --ref) REF="$2"; shift ;;
    --project) PROJECT="$2"; shift ;;
    --tier) TIER="$2"; shift ;;
    --shot-scale) SHOT_SCALE="$2"; shift ;;
    -h|--help) sed -n 2,18p "$0"; exit 0 ;;
    *) echo "unknown option: $1"; exit 2 ;;
  esac
  shift
done
TAG=smoke; [ "$LIVE" = 1 ] && TAG=smoke-live
mkdir -p "$SHOTS"
T0=$(date +%s)
WORK="$(mktemp -d /tmp/eidolon-smoke.XXXXXX)"
HTTP_PID=""
cleanup() { [ -n "$HTTP_PID" ] && kill "$HTTP_PID" 2>/dev/null; rm -rf "$WORK"; }
trap cleanup EXIT
ts() { printf '[%4ss]' $(( $(date +%s) - T0 )); }

# ------------------------------------------------------------------ 1. headless playthrough (background)
if [ "$RUN_PT" = 1 ]; then
  if [ -n "$REF" ]; then
    git -C "$ROOT" rev-parse --verify -q "$REF^{commit}" >/dev/null || { echo "unknown git ref: $REF"; exit 2; }
    PROJECT="$WORK/tree/eidolon-world"
    echo "$(ts) headless: snapshot of $REF ($(git -C "$ROOT" rev-parse --short "$REF")) in $PROJECT"
  fi
  (
    if [ -n "$REF" ]; then      # (in the background: the web smoke starts at once)
      mkdir -p "$WORK/tree"
      git -C "$ROOT" archive "$REF" eidolon-world | tar -x -C "$WORK/tree"
      [ -d "$REPO/.godot" ] && cp -r "$REPO/.godot" "$PROJECT/.godot"
    fi
    pt_once() {   # $1 = log file; prints the result: ok | failed | crash | timeout
      timeout "$PT_TIMEOUT" "$GODOT" --headless --fixed-fps 60 --path "$PROJECT" res://tests/playthrough.tscn > "$1" 2>&1
      local rc=$?
      if grep -q "^PLAYTHROUGH OK" "$1"; then echo ok
      elif grep -q "^PLAYTHROUGH FAILED" "$1"; then echo failed
      elif [ $rc -eq 124 ]; then echo timeout
      else echo "crash"; fi
    }
    L1="$SHOTS/$TAG-playthrough.log"; L2="$SHOTS/$TAG-playthrough-retry.log"; rm -f "$L2"
    r1=$(pt_once "$L1"); final="$r1"; flake=""
    if [ "$r1" = crash ]; then
      sig=$(grep -m1 -oE "Caller thread can't call this function|signal [0-9]+|Segmentation fault" "$L1" || true)
      echo "$(ts) headless: attempt 1 crashed (${sig:-no summary line}); retrying once" >&2
      r2=$(pt_once "$L2"); final="$r2"; flake="attempt 1 crashed (${sig:-no summary line})"
    fi
    LOG="$L1"; [ -f "$L2" ] && LOG="$L2"
    summary=$(grep -m1 "^PLAYTHROUGH" "$LOG" || echo "no PLAYTHROUGH line")
    { echo "result=$final"; echo "flake=$flake"; echo "summary=$summary"; echo "log=$LOG"
      grep "^FAIL" "$LOG" | head -20 | sed 's/^/fail=/'; } > "$WORK/pt.result"
  ) &
  PT_PID=$!
fi

# ------------------------------------------------------------------ 2. web smoke (foreground)
WEB_RC=0
if [ "$RUN_WEB" = 1 ]; then
  if [ "$LIVE" = 1 ]; then
    URL="$LIVE_URL?smoke=$T0"
  else
    PORT=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
    (cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
    HTTP_PID=$!
    for _ in $(seq 50); do curl -s -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.2; done
    URL="http://127.0.0.1:$PORT/eidolon-world/build/web/index.html"
  fi
  echo "$(ts) web: $URL (lock $LOCK)"
  flock "$LOCK" timeout 600 "$NODE" "$HERE/web_smoke.mjs" --url "$URL" --out "$SHOTS" --tag "$TAG" --tier "$TIER" --shot-scale "$SHOT_SCALE" \
    > "$SHOTS/$TAG-web.log" 2>&1
  WEB_RC=$?
  echo "$(ts) web: done (exit $WEB_RC)"
fi
[ "$RUN_PT" = 1 ] && wait "$PT_PID"

# ------------------------------------------------------------------ summary
FAILS=0
echo
echo "================ EIDOLON SMOKE ($([ "$LIVE" = 1 ] && echo live || echo local)) ================"
if [ "$RUN_PT" = 1 ]; then
  res=$(sed -n 's/^result=//p' "$WORK/pt.result"); flake=$(sed -n 's/^flake=//p' "$WORK/pt.result")
  summ=$(sed -n 's/^summary=//p' "$WORK/pt.result"); log=$(sed -n 's/^log=//p' "$WORK/pt.result")
  if [ "$res" = ok ]; then
    if [ -n "$flake" ]; then echo "PASS  headless playthrough (FLAKE: $flake; retry passed)  $summ"
    else echo "PASS  headless playthrough  $summ"; fi
  else
    FAILS=$((FAILS+1)); echo "FAIL  headless playthrough [$res]${flake:+ ($flake)}  $summ"
    sed -n 's/^fail=/        /p' "$WORK/pt.result"
  fi
  echo "      project: $PROJECT${REF:+ (ref $REF)}   log: $log"
fi
if [ "$RUN_WEB" = 1 ]; then
  if grep -qE "^(PASS|FAIL)  " "$SHOTS/$TAG-web.log"; then
    grep -E "^(PASS|FAIL)  " "$SHOTS/$TAG-web.log" | sed 's/^/web /' | cut -c1-260
  fi
  grep -E "^WEB SMOKE" "$SHOTS/$TAG-web.log" || echo "web smoke: no summary line (exit $WEB_RC), see $SHOTS/$TAG-web.log"
  [ "$WEB_RC" = 0 ] || FAILS=$((FAILS+1))
  echo "      shots: $SHOTS/$TAG-<room>.png   console: $SHOTS/$TAG-console.log   web log: $SHOTS/$TAG-web.log"
fi
echo "--------------------------------------------------------------"
WALL=$(( $(date +%s) - T0 ))
if [ "$FAILS" = 0 ]; then echo "SMOKE PASS  wall=${WALL}s"; else echo "SMOKE FAIL  ($FAILS part(s) failed)  wall=${WALL}s"; fi
[ "$FAILS" = 0 ]
