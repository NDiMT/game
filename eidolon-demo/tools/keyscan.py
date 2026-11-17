# Run from inside a git checkout after `git add`: tells whether any staged change or staged file holds the Tripo key.
# Prints only "clean" or "KEY FOUND": never the key.
import json, os, subprocess, sys
keys = []
def walk(o):
    if isinstance(o, dict):
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
    elif isinstance(o, str) and len(o) >= 20: keys.append(o.encode())
try: walk(json.load(open(os.path.expanduser('~/.tripo/config.json'))))
except Exception as e: print("config not read:", type(e).__name__)
try: keys.append(open(os.path.expanduser('~/.config/eidolon/gemini_key'),'rb').read().strip())
except Exception as e: print("gemini key not read:", type(e).__name__)
top = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip()
diff = subprocess.run(['git', 'diff', '--cached', '--binary'], capture_output=True, cwd=top).stdout
files = [f for f in subprocess.run(['git', 'diff', '--cached', '--name-only'], capture_output=True, text=True, cwd=top).stdout.split('\n') if f]
bad = any(k in diff for k in keys)
for f in files:
    fp = os.path.join(top, f)
    if os.path.isfile(fp) and any(k in open(fp, 'rb').read() for k in keys): bad = True
print("strings checked:", len(keys), "| files:", len(files), "|", "KEY FOUND" if bad else "clean")
sys.exit(1 if bad else 0)
