#!/usr/bin/env bash
# EIDOLON one-command smoke test, v3 (Chapter I v3 is the game: scenes/main3.tscn). Runs, in parallel:
#   1. (headless) every Chapter I v3 beat solved the way a player would, its contract checked (tests/pz_test.tscn
#      --pz=all; replaces the v2 playthrough), retried ONCE on an engine crash (known flake: "Caller thread can't call
#      this function" / signal 11) and reported as a flake if the retry passes
#   2. the web smoke (tests/web_smoke.mjs, v3: title, the prologue, I.1 by touch, a shot per part, the jingle, THE END by
#      touch; Playwright + SwiftShader, mobile 390x844 DPR 2) on build/web served by python3 -m http.server from
#      /home/user/game, or on the live site with --live
#   3. (REQUIRED) real touch in the web build: the mirror puzzle N.4 The Still Room (tests/web_still.mjs; replaces Our
#      Steps); with --act1-touch also Act 1 I.1-I.4 (tests/web_v3.mjs). Skip only with --no-touch (never for a release).
#   4. (REQUIRED with the headless part) the v3 world walked end to end, every part (tests/flow_v3.tscn; replaces flow_v2)
# Prints a PASS/FAIL summary; exit 0 only when everything passes. Run it under `timeout 1800`.
#
# Usage:  tests/smoke.sh [--live] [--web-only | --headless-only] [--project <dir>] [--tier low|high] [--shot-scale css|device] [--no-touch] [--act1-touch]
#   --live           web smoke against https://ndimt.github.io/game/eidolon-world/ (shots tagged smoke-live-*)
#   --project <dir>  headless parts on another project dir (default: this repo's working tree)
#   --tier <t>       quality tier for the web walk-through (default low; "high" is much slower under SwiftShader)
#   --shot-scale <s> css (default: 390x844 PNGs, fast) or device (780x1688 at DPR 2, slower)
# Outputs: dev/shots/<tag>-<space>.png, <tag>-console.log, <tag>-web.log, <tag>-pz[-retry].log, <tag>-touch-*.log, <tag>-flow.log
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"                       # .../eidolon-world
ROOT="$(cd "$REPO/.." && pwd)"                       # .../game (the http.server root)
GODOT="${GODOT:-/opt/godot/godot}"
NODE="${NODE:-node}"
LOCK=/home/user/game/realms/dev/.shotlock
LIVE_URL="https://ndimt.github.io/game/eidolon-world/index.html"
SHOTS="$REPO/dev/shots"
PT_TIMEOUT="${PT_TIMEOUT:-900}"                      # per headless attempt (a clean run takes ~1.5-3 min)

LIVE=0; RUN_PT=1; RUN_WEB=1; RUN_OS=1; RUN_ACT1=0; PROJECT="$REPO"; TIER=low; SHOT_SCALE=css
while [ $# -gt 0 ]; do
  case "$1" in
    --live) LIVE=1 ;;
    --web-only) RUN_PT=0 ;;
    --headless-only) RUN_WEB=0; RUN_OS=0 ;;
    --no-touch|--no-oursteps) RUN_OS=0 ;;
    --act1-touch) RUN_ACT1=1 ;;
    --project) PROJECT="$2"; shift ;;
    --tier) TIER="$2"; shift ;;
    --shot-scale) SHOT_SCALE="$2"; shift ;;
    -h|--help) sed -n 2,20p "$0"; exit 0 ;;
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

# ------------------------------------------------------------------ 1. headless: every v3 beat (background)
if [ "$RUN_PT" = 1 ]; then
  (
    pt_once() {   # $1 = log file; prints the result: ok | failed | crash | timeout
      # a private user:// per attempt (XDG_DATA_HOME): other Godot runs of this project share the app's user dir
      local ud; ud="$(mktemp -d "$WORK/userdata.XXXX")"
      XDG_DATA_HOME="$ud" timeout "$PT_TIMEOUT" "$GODOT" --headless --fixed-fps 60 --path "$PROJECT" res://tests/pz_test.tscn -- --pz=all > "$1" 2>&1
      local rc=$?
      if grep -q "^PZ PASS" "$1" && ! grep -qE "SCRIPT ERROR|Parse Error" "$1"; then echo ok
      elif grep -qE "^PZ FAIL|SCRIPT ERROR" "$1"; then echo failed
      elif [ $rc -eq 124 ]; then echo timeout
      else echo "crash"; fi
    }
    L1="$SHOTS/$TAG-pz.log"; L2="$SHOTS/$TAG-pz-retry.log"; rm -f "$L2"
    r1=$(pt_once "$L1"); final="$r1"; flake=""
    if [ "$r1" = crash ]; then
      sig=$(grep -m1 -oE "Caller thread can't call this function|signal [0-9]+|Segmentation fault" "$L1" || true)
      echo "$(ts) headless: attempt 1 crashed (${sig:-no summary line}); retrying once" >&2
      r2=$(pt_once "$L2"); final="$r2"; flake="attempt 1 crashed (${sig:-no summary line})"
    fi
    LOG="$L1"; [ -f "$L2" ] && LOG="$L2"
    summary=$(grep -m1 "^PZ " "$LOG" || echo "no PZ line")
    { echo "result=$final"; echo "flake=$flake"; echo "summary=$summary"; echo "log=$LOG"
      grep -E "^FAIL|SCRIPT ERROR" "$LOG" | head -20 | sed 's/^/fail=/'; } > "$WORK/pt.result"
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
  flock "$LOCK" timeout 900 "$NODE" "$HERE/web_smoke.mjs" --url "$URL" --out "$SHOTS" --tag "$TAG" --tier "$TIER" --shot-scale "$SHOT_SCALE" \
    > "$SHOTS/$TAG-web.log" 2>&1
  WEB_RC=$?
  echo "$(ts) web: done (exit $WEB_RC)"
fi
# ------------------------------------------------------------------ 3. real touch: Act 1 and N.4 (foreground, REQUIRED)
OS_RC=0
if [ "$RUN_OS" = 1 ]; then
  if [ "$RUN_WEB" != 1 ]; then OS_RC=2; echo "$(ts) touch: needs the web part (no URL)";
  else
    if [ "$RUN_ACT1" = 1 ]; then          # (I.1 by touch is in the web smoke already; I.2-I.4 by touch on request)
      echo "$(ts) touch: Act 1 (web_v3.mjs) $URL"
      flock "$LOCK" timeout 900 "$NODE" "$HERE/web_v3.mjs" --url "$URL" --out "$SHOTS" > "$SHOTS/$TAG-touch-act1.log" 2>&1 || OS_RC=1
    fi
    echo "$(ts) touch: N.4 The Still Room (web_still.mjs)"
    flock "$LOCK" timeout 900 "$NODE" "$HERE/web_still.mjs" --url "$URL" --out "$SHOTS" > "$SHOTS/$TAG-touch-still.log" 2>&1 || OS_RC=1
    echo "$(ts) touch: done (exit $OS_RC)"
  fi
fi
[ "$RUN_PT" = 1 ] && wait "$PT_PID"
# ------------------------------------------------------------------ 4. (REQUIRED) the v3 world walked end to end
FLOW_RC=0
if [ "$RUN_PT" = 1 ]; then
  echo "$(ts) v3 flow: tests/flow_v3.tscn"
  FUD="$(mktemp -d "$WORK/userdata.XXXX")"
  XDG_DATA_HOME="$FUD" timeout 400 "$GODOT" --headless --fixed-fps 60 --path "$PROJECT" res://tests/flow_v3.tscn > "$SHOTS/$TAG-flow.log" 2>&1
  { grep -q "^FLOW3 PASS" "$SHOTS/$TAG-flow.log" && ! grep -q "SCRIPT ERROR" "$SHOTS/$TAG-flow.log"; } || FLOW_RC=1
  echo "$(ts) v3 flow: done ($([ $FLOW_RC = 0 ] && echo pass || echo FAIL))"
fi

# ------------------------------------------------------------------ summary
FAILS=0
echo
echo "================ EIDOLON SMOKE ($([ "$LIVE" = 1 ] && echo live || echo local)) ================"
if [ "$RUN_PT" = 1 ]; then
  res=$(sed -n 's/^result=//p' "$WORK/pt.result"); flake=$(sed -n 's/^flake=//p' "$WORK/pt.result")
  summ=$(sed -n 's/^summary=//p' "$WORK/pt.result"); log=$(sed -n 's/^log=//p' "$WORK/pt.result")
  if [ "$res" = ok ]; then
    if [ -n "$flake" ]; then echo "PASS  headless beats (FLAKE: $flake; retry passed)  $summ"
    else echo "PASS  headless beats (every v3 beat by its autosolve)  $summ"; fi
  else
    FAILS=$((FAILS+1)); echo "FAIL  headless beats [$res]${flake:+ ($flake)}  $summ"
    sed -n 's/^fail=/        /p' "$WORK/pt.result"
  fi
  echo "      project: $PROJECT   log: $log"
fi
if [ "$RUN_WEB" = 1 ]; then
  if grep -qE "^(PASS|FAIL)  " "$SHOTS/$TAG-web.log"; then
    grep -E "^(PASS|FAIL)  " "$SHOTS/$TAG-web.log" | sed 's/^/web /' | cut -c1-260
  fi
  grep -E "^WEB SMOKE" "$SHOTS/$TAG-web.log" || echo "web smoke: no summary line (exit $WEB_RC), see $SHOTS/$TAG-web.log"
  [ "$WEB_RC" = 0 ] || FAILS=$((FAILS+1))
  echo "      shots: $SHOTS/$TAG-<room>.png   console: $SHOTS/$TAG-console.log   web log: $SHOTS/$TAG-web.log"
fi
if [ "$RUN_OS" = 1 ]; then
  for t in act1 still; do
    L="$SHOTS/$TAG-touch-$t.log"
    [ "$t" = act1 ] && [ "$RUN_ACT1" != 1 ] && continue
    grep -E "^FAIL  " "$L" 2>/dev/null | sed "s/^/touch $t /" | cut -c1-260
    echo "touch $t: PASS-count $(grep -cE '^PASS  ' "$L" 2>/dev/null) $(grep -oE '^(WEB3|STILL)_JSON \{"pass":(true|false)' "$L" 2>/dev/null || echo 'no summary line')"
  done
  if [ "$OS_RC" = 0 ]; then echo "PASS  touch (N.4 The Still Room$([ "$RUN_ACT1" = 1 ] && echo ', Act 1 I.1-I.4'))"; else FAILS=$((FAILS+1)); echo "FAIL  touch (see $SHOTS/$TAG-touch-*.log)"; fi
fi
if [ "$RUN_PT" = 1 ]; then
  if [ "$FLOW_RC" = 0 ]; then echo "PASS  v3 flow (Chapter I v3 walked end to end)  $(grep -m1 '^FLOW3 PASS' "$SHOTS/$TAG-flow.log")"
  else FAILS=$((FAILS+1)); echo "FAIL  v3 flow  $(grep -m1 '^FLOW3 ' "$SHOTS/$TAG-flow.log" || echo 'no FLOW3 line')"; grep "^FAIL" "$SHOTS/$TAG-flow.log" | head -10 | sed 's/^/        /'; fi
  echo "      log: $SHOTS/$TAG-flow.log"
fi
echo "--------------------------------------------------------------"
WALL=$(( $(date +%s) - T0 ))
if [ "$FAILS" = 0 ]; then echo "SMOKE PASS  wall=${WALL}s"; else echo "SMOKE FAIL  ($FAILS part(s) failed)  wall=${WALL}s"; fi
[ "$FAILS" = 0 ]
