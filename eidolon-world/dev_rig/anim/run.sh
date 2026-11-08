#!/usr/bin/env bash
# dev_rig/anim/run.sh OUT_PNG [extra args for anim_sheet: --only=.. --strip=.. --zoom=..] ; composes with cols=${COLS:-6} scale=${SC:-0.6}
set -e
cd "$(dirname "$0")/../.."
OUT="$1"; shift
D="$(mktemp -d)"
timeout 150 xvfb-run -a /opt/godot/godot --path . --rendering-driver opengl3 --fixed-fps 30 res://dev_rig/anim/anim_sheet.tscn -- --out="$D" "$@" 2>&1 | grep -E "SCRIPT ERROR|Parse Error|^ERROR" | grep -v "status < 0" | head -20 || true
python3 dev_rig/anim/compose.py "$D" "$OUT" "${COLS:-6}" "${SC:-0.6}"
rm -rf "$D"
