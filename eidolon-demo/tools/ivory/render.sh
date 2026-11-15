#!/bin/bash
# Render the ivory level's start frame (the title line faded) into <out_dir>/p1_start.png; extra VAR=value pairs pass on.
# usage: tools/ivory/render.sh <out_dir> [VAR=value ...]     (run from eidolon-demo/)
out=$1; shift
mkdir -p "$out"; rm -f "${out:?}"/*.png
env "$@" IV_CLEAN=1 GH_ONLY=start FLIP=goiv HAND=1 SHOT_DIR="$out" timeout 600 xvfb-run -a -s "-screen 0 720x1280x24" \
  /opt/godot/godot --rendering-driver opengl3 --path . --resolution 720x1280 --fixed-fps 30 res://chapter1.tscn -- godemo > "$out.log" 2>&1
grep -E 'SCRIPT ERROR|SHADER ERROR' "$out.log" | head -5
