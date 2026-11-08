#!/usr/bin/env bash
# quick.sh: fast iteration check (~1-2 min): parse/load every script+scene, then flow_v2 walk (default: whole route ~30 s, or one area); exit !=0 on failure.  Usage: tests/quick.sh [area|all|none]   (area = a Map2.PART: south hub west north east act3)
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
GODOT="${GODOT:-/opt/godot/godot}"; AREA="${1:-all}"; OUT="$REPO/dev/shots"; mkdir -p "$OUT"
T0=$(date +%s); UD="$(mktemp -d /tmp/eidolon-quick.XXXXXX)"; trap 'rm -rf "$UD"' EXIT; RC=0
# 1. parse/load: every .gd compiles, every scene loads, and no SCRIPT ERROR / Parse Error anywhere in the output
timeout 120 "$GODOT" --headless --path "$REPO" -s res://tests/parse_all.gd > "$OUT/quick-parse.log" 2>&1
if grep -q "^PARSE PASS" "$OUT/quick-parse.log" && ! grep -qE "SCRIPT ERROR|Parse Error" "$OUT/quick-parse.log"; then
  echo "PASS  parse  $(grep -m1 '^PARSE' "$OUT/quick-parse.log")"
else
  RC=1; echo "FAIL  parse  (log $OUT/quick-parse.log)"; grep -E "^FAIL|SCRIPT ERROR|Parse Error" "$OUT/quick-parse.log" | head -10 | cut -c1-220
fi
# 2. the flow walk, limited to one area ("all" = the whole route, ~3 min; "none" skips it)
if [ "$AREA" != none ]; then
  ARGS=(); [ "$AREA" != all ] && ARGS=(-- "--area=$AREA")
  XDG_DATA_HOME="$UD" timeout 240 "$GODOT" --headless --fixed-fps 60 --path "$REPO" res://tests/flow_v2.tscn "${ARGS[@]}" > "$OUT/quick-flow.log" 2>&1
  if grep -q "^FLOW PASS" "$OUT/quick-flow.log" && ! grep -qE "SCRIPT ERROR|Parse Error" "$OUT/quick-flow.log"; then
    echo "PASS  flow  $(grep -m1 '^FLOW PASS' "$OUT/quick-flow.log")"
  else
    RC=1; echo "FAIL  flow  $(grep -m1 '^FLOW ' "$OUT/quick-flow.log" || echo 'no FLOW line')  (log $OUT/quick-flow.log)"
    grep -E "^FAIL|SCRIPT ERROR|Parse Error" "$OUT/quick-flow.log" | head -10 | cut -c1-220
  fi
fi
echo "QUICK $([ $RC = 0 ] && echo PASS || echo FAIL)  wall=$(( $(date +%s) - T0 ))s"
exit $RC
