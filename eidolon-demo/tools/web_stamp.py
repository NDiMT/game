#!/usr/bin/env python3
"""Make a browser build safe to redeploy: a phone or an old tab must never run a stale copy.

usage: web_stamp.py BUILD_DIR VERSION
  BUILD_DIR holds an export made as eidolon-<VERSION>.html (so every file the page loads carries the version in
  its name and can never come from a cache). This writes BUILD_DIR/index.html (that page, with a small check at the
  top of its head) and BUILD_DIR/version.txt. The check asks the server, past every cache, which version is current;
  if this page is older (a cached page, or a tab left open), it loads the current one. It asks again when a tab
  comes back into view, or a page is restored from the browser's memory.
"""
import sys, pathlib, re
d, v = pathlib.Path(sys.argv[1]), sys.argv[2]
assert re.fullmatch(r'[0-9A-Za-z_-]+', v), 'version: letters, digits, - and _ only'
src = d / ('eidolon-%s.html' % v)
html = src.read_text()
check = ('<script>(function(){var V="%s";function chk(){fetch("version.txt?t="+Date.now(),{cache:"no-store"})'
         '.then(function(r){return r.ok?r.text():V}).then(function(t){t=(t||"").trim();'
         'if(/^[0-9A-Za-z_-]+$/.test(t)&&t!==V){location.replace(location.pathname+"?v="+t)}}).catch(function(){})}'
         'chk();addEventListener("pageshow",function(e){if(e.persisted)chk()});'
         'document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")chk()})})();</script>') % v
assert '<head>' in html
html = html.replace('<head>', '<head>\n' + check, 1)
(d / 'index.html').write_text(html)
(d / 'version.txt').write_text(v + '\n')
src.unlink()
print('stamped', v, '->', d / 'index.html')
