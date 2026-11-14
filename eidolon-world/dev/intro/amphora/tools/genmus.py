#!/usr/bin/env python3
# usage: genmus.py PROMPT_FILE OUT_BASENAME   (env MODEL=lyria-3.5) : a piece of music from a written description
import sys, os, json, base64, subprocess, tempfile, re
pf, out = sys.argv[1], sys.argv[2]
body = {'model': os.environ.get('MODEL', 'lyria-3.5'), 'input': open(pf).read(), 'response_format': {'type': 'audio'}}
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f: json.dump(body, f); bf = f.name
r = subprocess.run(['curl', '-s', '-m', '900', '-K', os.path.expanduser('~/.config/eidolon/gemini_curl'), '-H', 'Content-Type: application/json', '-H', 'Api-Revision: 2026-05-20', '-d', '@' + bf, 'https://generativelanguage.googleapis.com/v1beta/interactions'], capture_output=True)
os.unlink(bf)
try: d = json.loads(r.stdout)
except Exception: print('BAD RESPONSE', re.sub(r'AQ\.[\w\-]+', '<key>', r.stdout[:300].decode('utf8', 'replace'))); sys.exit(1)
if 'error' in d: print('ERR', d['error'].get('code'), re.sub(r'AQ\.[\w\-]+', '<key>', d['error'].get('message', ''))[:500]); sys.exit(1)
n = 0
for st in d.get('steps', []):
    for p in (st.get('content') or []):
        if p.get('type') == 'audio' and p.get('data'):
            ext = 'wav' if 'wav' in (p.get('mime_type') or '') else 'mp3'; open('%s.%s' % (out, ext), 'wb').write(base64.b64decode(p['data'])); n += 1; print('saved %s.%s' % (out, ext), p.get('mime_type'))
        elif p.get('type') == 'text': print('TEXT', (p.get('text') or '')[:600])
print('audio blocks:', n, 'status', d.get('status'), [s.get('type') for s in d.get('steps', [])])
