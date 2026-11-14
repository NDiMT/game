#!/usr/bin/env python3
# usage: gen.py OUT.png PROMPT_FILE [ref1.png ref2.png ...]   (env MODEL, ASPECT, SIZE)
import sys, os, json, base64, subprocess, tempfile, re
out, pf, refs = sys.argv[1], sys.argv[2], sys.argv[3:]
model = os.environ.get('MODEL', 'gemini-3-pro-image')
parts = []
for r in refs:
    mt = 'image/jpeg' if r.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
    parts.append({'inlineData': {'mimeType': mt, 'data': base64.b64encode(open(r, 'rb').read()).decode()}})
parts.append({'text': open(pf).read()})
body = {'contents': [{'role': 'user', 'parts': parts}],
        'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'],
                             'imageConfig': {'aspectRatio': os.environ.get('ASPECT', '9:16'), 'imageSize': os.environ.get('SIZE', '2K')}}}
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
    json.dump(body, f); bf = f.name
url = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % model
r = subprocess.run(['curl', '-s', '-m', '300', '-K', os.path.expanduser('~/.config/eidolon/gemini_curl'), '-H', 'Content-Type: application/json', '-d', '@' + bf, url], capture_output=True)
os.unlink(bf)
try: d = json.loads(r.stdout)
except Exception: print('BAD RESPONSE', r.stdout[:300]); sys.exit(1)
if 'error' in d: print('ERR', d['error'].get('code'), re.sub(r'AQ\.[\w\-]+', '<key>', d['error'].get('message', ''))[:400]); sys.exit(1)
n = 0
for c in d.get('candidates', []):
    for p in c.get('content', {}).get('parts', []):
        if 'inlineData' in p:
            fn = out if n == 0 else out.replace('.png', '_%d.png' % n)
            open(fn, 'wb').write(base64.b64decode(p['inlineData']['data'])); n += 1
        elif 'text' in p and not p.get('thought'): print('TEXT', p['text'][:200].replace('\n', ' '))
print('saved', n, 'image(s)', out, 'finish', [c.get('finishReason') for c in d.get('candidates', [])], 'usage', d.get('usageMetadata', {}).get('totalTokenCount'))
