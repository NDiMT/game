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
# sound on phones: an iPhone plays the page's sound as media (not muted by its silent switch), and at every touch,
# click or key each audio context the page made is resumed and given a silent sound, inside the gesture itself,
# as Safari asks
unlock = ('<script>(function(){function pb(){try{if(navigator.audioSession)navigator.audioSession.type="playback"}catch(e){}}pb();'
          'var C=window.AudioContext||window.webkitAudioContext;if(!C)return;var all=[];'
          'var W=function(o){var c=(o===undefined)?new C():new C(o);all.push(c);return c};W.prototype=C.prototype;'
          'window.AudioContext=W;if(window.webkitAudioContext)window.webkitAudioContext=W;'
          'function go(){pb();all.forEach(function(c){try{if(c.state!=="running")c.resume();if(!c.__pinged){c.__pinged=1;'
          'var s=c.createBufferSource();s.buffer=c.createBuffer(1,1,22050);s.connect(c.destination);s.start(0)}}catch(e){}})}'
          '["touchend","click","keydown","pointerup"].forEach(function(t){document.addEventListener(t,go,true)})})();</script>')
assert '<head>' in html
html = html.replace('<head>', '<head>\n' + check + '\n' + unlock, 1)
(d / 'index.html').write_text(html)
(d / 'version.txt').write_text(v + '\n')
src.unlink()
print('stamped', v, '->', d / 'index.html')
