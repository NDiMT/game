#!/bin/bash
# The third level (gomilos/) in two layers, as the owner settled it (18/11): the way as the other levels have it (the
# slabs, the grey-blue stone cut sharp under them, the stair, the gate's arch, the bridge) by tools/ivory_level.py from
# the plan without its rocks; then the first build's white sea-worn rock round it by tools/go/milos_island.py, which
# keeps clear of the way's places (rock_drop) and joins the way's GLB to its own. Writes gomilos/level.glb,
# level.json, shore.png.   usage: bash tools/go/milos_build.sh [scratch dir]
set -e
cd "$(dirname "$0")/../.."
T=${1:-/tmp/milos_build}; mkdir -p "$T"
python3 -I tools/go/milos_plan.py gomilos/plan.json | tail -1
python3 -c "
import json; p = json.load(open('gomilos/plan.json')); p['rocks'] = []; p['shore'] = False
json.dump(p, open('$T/way_plan.json', 'w'), indent=1)"
python3.11 -I tools/ivory_level.py -- "$T/way.glb" "$T/way.json" 731 24 "$T/way_plan.json" > "$T/way.log" 2>&1; grep -E "TRIS|DONE" "$T/way.log"
python3.11 -I tools/go/milos_island.py -- gomilos/plan.json gomilos "$T/way.glb" 0.06 > "$T/island.log" 2>&1; grep -E "MESH|THINNED|EXTRAS|DONE" "$T/island.log"
