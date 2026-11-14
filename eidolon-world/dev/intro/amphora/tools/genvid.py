#!/usr/bin/env python3
# usage: genvid.py CARD PROMPT_FILE OUT.mp4   (env DUR=8s, RES=1080p, LOOP=1: the same picture is first and last frame)
# the panel is set in a 16:9 frame between two bands of black glaze, as it sits on the vase
import sys, os, json, base64, subprocess, tempfile, re, io
from PIL import Image
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
c, pf, out = int(sys.argv[1]), sys.argv[2], sys.argv[3]
cv = Image.new('RGB', (1920, 1080), (26, 20, 24)); cv.paste(Image.open(S + '/v/big/panel%d.png' % c).convert('RGB').resize((1080, 1080), Image.LANCZOS), (420, 0))
cv.save(S + '/vid/first%d.png' % c); b = io.BytesIO(); cv.save(b, 'JPEG', quality=96); img = base64.b64encode(b.getvalue()).decode()
part = {'type': 'image', 'data': img, 'mime_type': 'image/jpeg'}
inp = [part] + ([part] if os.environ.get('LOOP', '1') == '1' else []) + [{'type': 'text', 'text': open(pf).read()}]
body = {'model': os.environ.get('MODEL', 'gemini-omni-1.2-flash'), 'input': inp, 'store': False, 'background': False, 'stream': False,
        'response_format': {'type': 'video', 'aspect_ratio': '16:9', 'resolution': os.environ.get('RES', '1080p'), 'duration': os.environ.get('DUR', '8s')}}
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f: json.dump(body, f); bf = f.name
r = subprocess.run(['curl', '-s', '-m', '900', '-K', os.path.expanduser('~/.config/eidolon/gemini_curl'), '-H', 'Content-Type: application/json', '-d', '@' + bf, 'https://generativelanguage.googleapis.com/v1beta/interactions'], capture_output=True)
os.unlink(bf)
try: d = json.loads(r.stdout)
except Exception: print('BAD RESPONSE', re.sub(r'AQ\.[\w\-]+', '<key>', r.stdout[:300].decode('utf8', 'replace'))); sys.exit(1)
if 'error' in d: print('ERR', d['error'].get('code'), re.sub(r'AQ\.[\w\-]+', '<key>', d['error'].get('message', ''))[:500]); sys.exit(1)
n = 0
for st in d.get('steps', []):
    for p in (st.get('content') or []):
        if p.get('type') == 'video' and p.get('data'): open(out, 'wb').write(base64.b64decode(p['data'])); n += 1
        elif p.get('type') == 'video' and p.get('uri'): print('URI delivery', p['uri'][:60])
        elif p.get('type') == 'text': print('TEXT', p.get('text', '')[:200])
print('saved' if n else 'NO VIDEO', out, 'status', d.get('status'), 'usage', json.dumps(d.get('usage', {}))[:200], [s.get('type') for s in d.get('steps', [])])
