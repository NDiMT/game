#!/usr/bin/env python3
# usage: gentts.py TEXT_FILE OUT.wav   (env VOICE, STYLE, MODEL) : a narrator speaks the text (24 kHz mono WAV)
import sys, os, json, base64, subprocess, tempfile, re
tf, out = sys.argv[1], sys.argv[2]
style = os.environ.get('STYLE', 'a low, hushed woman\'s voice, close to a whisper, very slow and grave, like someone very old telling a sorrowful legend she remembers; unhurried, with long pauses')
body = {'model': os.environ.get('MODEL', 'gemini-3.8-flash-tts'),
        'input': [{'type': 'user_input', 'content': [{'type': 'text', 'text': open(tf).read().strip(), 'annotations': [{'type': 'speech_metadata', 'style': style}]}]}],
        'response_format': {'type': 'audio'}, 'generation_config': {'speech_config': [{'voice': os.environ.get('VOICE', 'en-gb-tutor-12')}]}}
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f: json.dump(body, f); bf = f.name
r = subprocess.run(['curl', '-s', '-m', '600', '-K', os.path.expanduser('~/.config/eidolon/gemini_curl'), '-H', 'Content-Type: application/json', '-d', '@' + bf, 'https://generativelanguage.googleapis.com/v1beta/interactions'], capture_output=True)
os.unlink(bf)
try: d = json.loads(r.stdout)
except Exception: print('BAD RESPONSE', re.sub(r'AQ\.[\w\-]+', '<key>', r.stdout[:300].decode('utf8', 'replace'))); sys.exit(1)
if 'error' in d: print('ERR', d['error'].get('code'), re.sub(r'AQ\.[\w\-]+', '<key>', d['error'].get('message', ''))[:500]); sys.exit(1)
n = 0
for st in d.get('steps', []):
    for p in (st.get('content') or []):
        if p.get('type') == 'audio' and p.get('data'): open(out, 'wb').write(base64.b64decode(p['data'])); n += 1
print('saved' if n else 'NO AUDIO', out, d.get('status'))
