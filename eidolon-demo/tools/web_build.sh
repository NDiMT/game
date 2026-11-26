#!/bin/bash
# web_build.sh <version> [work dir]: the web build of the current commit into <work>/web_<v>, stamped (web_stamp.py); its
# pack listed; the APK (build/android/eidolon-waking.apk); then every level checked in a headless browser
# (tools/web_check.js: the film skipped, PLAY or the level's number touched, the level run a while, its logs counted).
# Deploys nothing: the site's folder is site/eidolon-waking/ on the branch claude/solo-game-ideas-balatro-yj6hqw.
#   bash eidolon-demo/tools/web_build.sh $(git rev-parse --short HEAD) /tmp/eidolon_build
v=$1; B=${2:-/tmp/eidolon_build}; W=$B/web_$v; P=$B/check_$v
D=$(cd "$(dirname "$0")/.." && pwd)
rm -rf $W $P; mkdir -p $W $P
cd $D && mkdir -p build/android
timeout 1200 /opt/godot/godot --headless --path . --export-release "WebWake" $W/eidolon-$v.html > $B/web_$v.export.log 2>&1; echo "web export rc=$?"
python3 -I tools/web_stamp.py $W $v 2>&1 | grep -v -iE "key|token|secret|auth" | tail -3
python3 -I tools/pck_list.py $W/eidolon-$v.pck 2>/dev/null | grep -E "go[a-z]+/level" | sed 's/^/  pck: /'
echo "  pck sfx files: $(python3 -I tools/pck_list.py $W/eidolon-$v.pck 2>/dev/null | grep -c 'sfx/')"
timeout 1200 /opt/godot/godot --headless --path . --export-debug "AndroidWake" build/android/eidolon-waking.apk > $B/apk_$v.log 2>&1; echo "apk rc=$? size $(du -m build/android/eidolon-waking.apk | cut -f1) MB"
PORT=8791; export PORT
(cd $W && exec python3 -m http.server $PORT --bind 127.0.0.1 > $P/http.log 2>&1) & HP=$!
sleep 2
export NLEV=6
for lv in 1 2 3 4 5 6; do timeout 1500 node $D/tools/web_check.js $P $lv > $P/out$lv.txt 2>&1; head -1 $P/out$lv.txt; done
kill $HP 2>/dev/null
echo "BUILD $v DONE"
