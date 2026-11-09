#!/usr/bin/env bash
# quick.sh: fast iteration check: parse/load all scripts+scenes, the rigs' anatomy (anim_sanity), the v3 flow walk, the v3 puzzle/foundation test; exit !=0 on failure.  Usage: tests/quick.sh [--v3=all|<part>|none] [--pz=all|<id>|foundations|none]
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
GODOT="${GODOT:-/opt/godot/godot}"; OUT="$REPO/dev/shots"; mkdir -p "$OUT"
V3=all; PZ=all
for a in "$@"; do case "$a" in --v3=*) V3="${a#*=}";; --pz=*) PZ="${a#*=}";;
  -h|--help) sed -n 2p "$0"; exit 0;; *) echo "unknown option: $a"; exit 2;; esac; done
T0=$(date +%s); UD="$(mktemp -d /tmp/eidolon-quick.XXXXXX)"; trap 'rm -rf "$UD"' EXIT; RC=0
# run <name> <log> <pass-regex> <timeout> <godot args...>: PASS when the pass line is there and no script error was printed
run() {
  local name="$1" log="$2" pat="$3" to="$4"; shift 4
  XDG_DATA_HOME="$UD" timeout "$to" "$GODOT" --headless "$@" > "$log" 2>&1
  if grep -qE "$pat" "$log" && ! grep -qE "SCRIPT ERROR|Parse Error" "$log"; then echo "PASS  $name  $(grep -m1 -E "$pat" "$log" | cut -c1-120)"
  else RC=1; echo "FAIL  $name  (log $log)"; grep -E "^FAIL|SCRIPT ERROR|Parse Error" "$log" | head -10 | cut -c1-220; fi
}
run parse "$OUT/quick-parse.log" "^PARSE PASS" 120 --path "$REPO" -s res://tests/parse_all.gd
# (a6) the rigs' anatomy: every heroine clip / walk / hold / aim + the Warden, elbows / knees / twists / flips / skin
run "anim sanity" "$OUT/quick-anim.log" "^ANIM PASS" 300 --fixed-fps 60 --path "$REPO" res://tests/anim_sanity.tscn
if [ "$V3" != none ]; then A=(); [ "$V3" != all ] && A=(-- "--area=$V3")
  run "v3 flow ($V3)" "$OUT/quick-flow3.log" "^FLOW3 PASS" 240 --fixed-fps 60 --path "$REPO" res://tests/flow_v3.tscn "${A[@]}"; fi
if [ "$PZ" != none ]; then
  run "v3 puzzles ($PZ)" "$OUT/quick-pz.log" "^PZ PASS" 900 --fixed-fps 60 --path "$REPO" res://tests/pz_test.tscn -- "--pz=$PZ"; fi
echo "QUICK $([ $RC = 0 ] && echo PASS || echo FAIL)  wall=$(( $(date +%s) - T0 ))s"
exit $RC
