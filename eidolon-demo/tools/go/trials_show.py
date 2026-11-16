"""Show a found board of tools/go/trials_search.py as text: the grid (y up), its things, the proof and what each thing does.
usage: python3 -I tools/go/trials_show.py <trials_found_*.json> <idea>"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
PATH = sys.argv[1]
sys.argv = [sys.argv[0], sys.argv[2] if len(sys.argv) > 2 else 'mirror', '0', '1']
import trials_search as ts
from trials import *
g = json.load(open(PATH))['genome']
t = ts.build(g)
cells = {tuple(c) for c in g['cells']}
tag = {}
for f in g['faces']: tag[tuple(f[0])] = 'F' + 'ESWN'[f[1]]
for m in g['mirrors']: tag[tuple(m[0])] = 'M' + '/\\'[m[1]]
for h in g['hunters']: tag[tuple(h[0])] = 'H' + 'ESWN'[h[1]]
for c in g['cracks']: tag[tuple(c)] = 'xx'
if g['stone']: tag[tuple(g['stone'])] = '##'
tag[tuple(g['start'])] = 'S '; tag[tuple(g['ring'])] = 'R '
for y in range(ts.GH - 1, -1, -1):
    row = ''; mid = ''
    for x in range(ts.GW):
        c = (x, y)
        row += ('%-2s' % tag.get(c, 'o ') if c in cells else '  ')
        e = t.B.level.get((c, (x + 1, y))); gp = t.B.gap.get((c, (x + 1, y)))
        row += ' - ' if e else (' ~ ' if gp else ('  ' + ('=' if t.B.level.get((c, (x + 1, y))) is False else ' ')))
        dn = (x, y - 1); e2 = t.B.level.get((c, dn)); g2 = t.B.gap.get((c, dn)); f2 = t.B.level.get((c, dn)) is False
        mid += ('|    ' if e2 else ('~    ' if g2 else ('"    ' if f2 else '     ')))
    print(row); print(mid)
sol = report(PATH.split('/')[-1], t)
