"""The ring before a level's gate set back from the door along the way (the owner, 22/11: "the bright circles should
never be right at the door"; and of the first level: "no second-to-last dot: the stair's path takes you straight to
the last bright circle").

The exit node (the ring's place) is moved along its last edge, toward the node before it, until its middle stands
`dist` metres from the middle of the level's arch (plan.json `arches`); with `drop`, the node before it (the head of the
stair, 0.9 m short of the ring in the first two levels) is taken out first, and the edge into it runs on to the ring
with its own waypoints (the stair), so one swipe takes her up the stair and to the ring; the solution follows.

Only the level's puzzle.json changes (the game reads its nodes and edges there; the level as built is untouched). Run it
again whenever a level's puzzle.json is made anew by its plan script:

  python3 -I tools/go/ring_clear.py gowake 1.15 drop
  python3 -I tools/go/ring_clear.py goveil 1.15 drop
  python3 -I tools/go/ring_clear.py gomilos 1.15
  python3 -I tools/go/ring_clear.py goglass 1.1
  python3 -I tools/go/ring_clear.py goguard 1.15
"""
import json, math, sys

lv, dist = sys.argv[1], float(sys.argv[2])
drop = 'drop' in sys.argv[3:]
raw = open(lv + '/puzzle.json').read(); pz = json.loads(raw)
ind = len(raw.split('\n')[1]) - len(raw.split('\n')[1].lstrip(' ')) or 1      # (the file's own indent, so its diff is only the change)
pl = json.load(open(lv + '/plan.json'))
R = pz['exit']; N = pz['nodes']; E = pz['edges']
arch = pl['arches'][0][0]

def last_edge():
    es = [e for e in E if R in e[:2]]
    assert len(es) == 1, 'the ring has %d edges' % len(es)
    e = es[0]
    return e, (e[0] if e[1] == R else e[1])

e, prev = last_edge()
if drop:
    into = [x for x in E if prev in x[:2] and R not in x[:2]]
    assert len(into) == 1, 'the node before the ring has %d other edges' % len(into)
    x = into[0]; before = x[0] if x[1] == prev else x[1]
    way = list(x[2]) if x[0] == before else list(reversed(x[2]))
    E.remove(e); E.remove(x)
    E.append([before, R, way])
    del N[prev]
    pz['solution'] = [n for n in pz['solution'] if n != prev]
    print('dropped', prev, '- the way from', before, 'runs on to', R)
    e, prev = last_edge()
    a = (e[2][-1] if e[0] == prev else e[2][0]) if e[2] else N[prev]      # (the stair's head, where the ring's last stretch starts)
else:
    a = N[prev]
r = N[R]
dx, dz = a[0] - r[0], a[2] - r[2]; L = math.hypot(dx, dz)
ux, uz = dx / L, dz / L      # (from the ring back along the way)
d0 = math.hypot(r[0] - arch[0], r[2] - arch[2])
t = dist - d0      # (how far to move it: along the way, away from the gate)
assert 0 <= t < L, 'cannot set it %.2f m back on a stretch of %.2f m' % (t, L)
N[R] = [round(r[0] + ux * t, 3), r[1], round(r[2] + uz * t, 3)]
json.dump(pz, open(lv + '/puzzle.json', 'w'), indent=ind)
print(lv, 'ring', r, '->', N[R], '(%.2f m from the gate\'s middle, was %.2f)' % (dist, d0))
