"""A trial for the ivory level of Eidolon GO, all new: "The Thousand Gazes". On the level's own floors and flights:

  - Ione moves one node per swipe.
  - A carved face looks one way along the level paths of its floor, node after node, until the stone stands in the
    way. Its look strikes the first one in it: Ione (turned to stone: the trial begins again) or another face, which
    cracks and falls (its plinth stays). So faces can be set on one another.
  - Walk into a face (from beside it or behind it) and it falls.
  - The stone is pushed one node straight on along a level path, if the node beyond is free (never onto a plinth, the
    volute or the ring). Behind it is shade.
  - The volute is a lever: swipe into it from beside it and it turns; each face bound to it turns a quarter (sunwise).
  - Reach the ring of light on the top.

The generator lays faces, the stone and the volute's bonds on the level's nodes, proves every candidate by a
breadth-first search over the whole state and keeps the best: a shortest way of MIN..MAX swipes, the only one of its
length, no state from which the ring cannot be reached, every thing needed, and in that way at least one turn of the
volute, one push, one face struck by another face, one face walked into.

usage: python3 -I tools/ivory/puzzle3_design.py [tries] [seed] [min] [max] [--write]
"""
import json, math, os, random, sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
T = json.load(open(os.path.join(ROOT, 'goiv', 'trace.json')))
H = {k: v['h'] for k, v in T['floors'].items()}
a = [x for x in sys.argv[1:] if not x.startswith('--')]
TRIES = int(a[0]) if len(a) > 0 else 30000
rnd = random.Random(int(a[1]) if len(a) > 1 else 5)
MIN = int(a[2]) if len(a) > 2 else 18
MAX = int(a[3]) if len(a) > 3 else 30

# ------------------------------------------------------------------ the way on the level: a grid on each floor, the flights between
NODES = {'a0': ('T0', 1.2, 4.95), 'a1': ('T0', 0.175, 4.95), 'a2': ('T0', 0.175, 3.95)}
for i, x in enumerate((-0.575, 0.175, 0.925, 1.675)):
    for j, z in enumerate((1.45, 0.7, -0.05)): NODES['t%d%d' % (i, j)] = ('T1', x, z)
for i, x in enumerate((0.175, 0.925, 1.675)):
    for j, z in enumerate((-1.97, -2.72)): NODES['l%d%d' % (i, j)] = ('L', x, z)
NODES.update({'u0': ('T2', -2.35, -1.97), 'u1': ('T2', -3.1, -1.97), 'u2': ('T2', -3.1, -2.67), 'ring': ('T3', -3.1, -4.95)})
POS = {n: (x, H[f], z) for n, (f, x, z) in NODES.items()}
FLOOR = {n: f for n, (f, x, z) in NODES.items()}
NAMES = list(NODES); IX = {n: i for i, n in enumerate(NAMES)}
EDGES = []      # (a, b, level?)
for n in NAMES:
    for m in NAMES:
        (f, x, z), (f2, x2, z2) = NODES[n], NODES[m]
        if n < m and f == f2 and abs(math.hypot(x - x2, z - z2) - 0.75) < 0.06 and (abs(x - x2) < 0.01 or abs(z - z2) < 0.01): EDGES.append((n, m, True))
EDGES += [('a0', 'a1', True), ('a1', 'a2', True), ('a2', 't10', False), ('t12', 'l00', False), ('l00', 'u0', False), ('u2', 'ring', False)]
EDGES = [e for e in EDGES if not (e[2] and FLOOR[e[0]] == 'T2' and {e[0], e[1]} == {'u0', 'u2'})]
NB = [[] for _ in NAMES]; LEVEL = {}
for p, q, lv in EDGES:
    i, j = IX[p], IX[q]; NB[i].append(j); NB[j].append(i); LEVEL[(i, j)] = LEVEL[(j, i)] = lv
DIRS = [(1, 0), (0, -1), (-1, 0), (0, 1)]      # (x, z): east, then sunwise as the eye sees it from above
def go(i, d):
    """the node one level step from i the way d (an index into DIRS), or -1"""
    dx, dz = DIRS[d]
    for j in NB[i]:
        if not LEVEL[(i, j)]: continue
        vx, vz = POS[NAMES[j]][0] - POS[NAMES[i]][0], POS[NAMES[j]][2] - POS[NAMES[i]][2]; L = math.hypot(vx, vz)
        if (vx * dx + vz * dz) / L > 0.95: return j
    return -1
GO = [[go(i, d) for d in range(4)] for i in range(len(NAMES))]
def way_dir(i, j):
    vx, vz = POS[NAMES[j]][0] - POS[NAMES[i]][0], POS[NAMES[j]][2] - POS[NAMES[i]][2]; L = math.hypot(vx, vz)
    for d, (dx, dz) in enumerate(DIRS):
        if (vx * dx + vz * dz) / L > 0.95: return d
    return -1
START, RING = IX['a0'], IX['ring']


class Trial:
    def __init__(s, faces, stone, lever, bound):
        s.faces = [(IX[n], d) for n, d in faces]      # (node, way it looks at first)
        s.stone0 = IX[stone]; s.lever = IX[lever] if lever else -1; s.bound = set(bound)      # (which faces the volute turns)
        s.plinths = {f for f, _ in s.faces}
    def fdir(s, k, rot): return (s.faces[k][1] + (rot if k in s.bound else 0)) % 4
    def looks(s, stone, alive, rot):
        """settle the looks: faces struck by faces fall (and the faces behind them then see further); what is watched"""
        while True:
            fall = 0; seen = set()
            pos = {s.faces[k][0]: k for k in range(len(s.faces)) if alive >> k & 1}
            for k in range(len(s.faces)):
                if not alive >> k & 1: continue
                j = GO[s.faces[k][0]][s.fdir(k, rot)]
                while j >= 0 and j != stone:
                    if j in pos: fall |= 1 << pos[j]; break
                    seen.add(j); j = GO[j][s.fdir(k, rot)]
            if not fall: return alive, seen
            alive &= ~fall
    def init(s):
        alive, seen = s.looks(s.stone0, (1 << len(s.faces)) - 1, 0)
        return (START, s.stone0, alive, 0), seen
    def step(s, st, j):
        """her swipe toward j: the state after it and what happened, or None if it cannot be done; dead if struck"""
        me, stone, alive, rot = st; ev = ''
        if j == s.lever:      # (she turns it from beside it)
            rot = (rot + 1) % 4; ev = 'turn'
            nme = me
        else:
            nme = j
            if j == stone:
                d = way_dir(me, j)
                t = GO[j][d] if (d >= 0 and LEVEL[(me, j)]) else -1
                if t < 0 or t == RING or t == s.lever or t in s.plinths: return None
                stone = t; ev = 'push'
            for k, (f, _) in enumerate(s.faces):
                if alive >> k & 1 and f == j: alive &= ~(1 << k); ev = 'break'
        a2, seen = s.looks(stone, alive, rot)
        if a2 != alive and ev != 'break': ev = (ev + '+' if ev else '') + 'struck'
        elif a2 != alive: ev += '+struck'
        return (nme, stone, a2, rot), ev, nme in seen


def solve(t, want_traps=True):
    s0, seen0 = t.init()
    if START in seen0: return None
    dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; q = deque([s0]); succ = {}
    while q:
        st = q.popleft(); succ[st] = []
        if st[0] == RING: continue
        for j in NB[st[0]] + ([t.lever] if t.lever >= 0 and t.lever in NB[st[0]] else []):
            if j == t.lever and st[0] == t.lever: continue
            r = t.step(st, j)
            if r is None: continue
            nst, ev, dead = r
            if dead or nst == st: continue
            succ[st].append(nst)
            if nst not in dist:
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = (st, j, ev); q.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    goals = [g for g in dist if g[0] == RING]
    if not goals: return None
    best = min(dist[g] for g in goals); nw = sum(ways[g] for g in goals if dist[g] == best)
    g = min((g for g in goals if dist[g] == best))
    path = []; c = g
    while prev[c] is not None: st, j, ev = prev[c]; path.append((NAMES[j], ev)); c = st
    path.reverse()
    traps = 0
    if want_traps:
        can = set(goals); rev = {}
        for st, ns in succ.items():
            for n2 in ns: rev.setdefault(n2, []).append(st)
        stack = list(goals)
        while stack:
            c = stack.pop()
            for p in rev.get(c, []):
                if p not in can: can.add(p); stack.append(p)
        traps = sum(1 for x in dist if x not in can)
    return dict(len=best, ways=nw, path=path, states=len(dist), traps=traps)


def candidate():
    walk = [n for n in NAMES if n not in ('a0', 'ring')]
    lever = rnd.choice(['t31', 't30', 't21'])
    faces = []
    for _ in range(rnd.choice((2, 3, 3))):
        n = rnd.choice([x for x in walk if x != lever and x not in [f for f, _ in faces]])
        ds = [d for d in range(4) if GO[IX[n]][d] >= 0]
        if not ds: return None
        faces.append((n, rnd.choice(ds)))
    stone = rnd.choice([x for x in NAMES if FLOOR[x] in ('T1', 'L') and x != lever and x not in [f for f, _ in faces]])
    bound = [k for k in range(len(faces)) if rnd.random() < 0.5]
    if not bound: bound = [rnd.randrange(len(faces))]
    return (faces, stone, lever, bound)


def judge(spec):
    faces, stone, lever, bound = spec
    t = Trial(faces, stone, lever, bound)
    s0, _ = t.init()
    if s0[2] != (1 << len(faces)) - 1: return None      # (no face falls before she moves)
    sol = solve(t, want_traps=False)
    if not sol or not (MIN <= sol['len'] <= MAX) or sol['ways'] != 1: return None
    evs = [ev for _, ev in sol['path']]
    if not any('turn' in e for e in evs) or not any('push' in e for e in evs) or not any('struck' in e for e in evs) or not any(e.startswith('break') for e in evs): return None
    sol = solve(t)
    if sol['traps'] > 0: return None
    for k in range(len(faces)):      # (every face in the way)
        f2 = [f for i, f in enumerate(faces) if i != k]; b2 = [i - (i > k) for i in bound if i != k]
        s2 = solve(Trial(f2, stone, lever, b2), want_traps=False)
        if s2 is not None and s2['len'] >= sol['len'] - 1: return None
    s3 = solve(Trial(faces, stone, None, []), want_traps=False)
    if s3 is not None and s3['len'] >= sol['len'] - 1: return None      # (the volute needed)
    seen = len({n for n, _ in sol['path']})
    score = sol['len'] * 0.6 + seen * 0.5 + 3 * sum('struck' in e for e in evs) + 1.5 * sum('push' in e for e in evs) + 1.5 * sum('turn' in e for e in evs)
    return dict(score=score, sol=sol, spec=spec)


if __name__ == '__main__':
    found = []; seen_specs = set()
    for k in range(TRIES):
        spec = candidate()
        if spec is None: continue
        key = json.dumps(spec)
        if key in seen_specs: continue
        seen_specs.add(key)
        j = judge(spec)
        if j: found.append(j)
    found.sort(key=lambda j: -j['score'])
    print('found', len(found))
    for j in found[:6]:
        faces, stone, lever, bound = j['spec']
        print('\n=== score %.1f  len %d  states %d' % (j['score'], j['sol']['len'], j['sol']['states']))
        print('faces', [(f, 'ESWN'[d]) for f, d in faces], 'stone', stone, 'lever', lever, 'bound', bound)
        print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in j['sol']['path']))
    if '--write' in sys.argv and found:
        json.dump([j['spec'] for j in found[:6]], open(os.path.join(ROOT, 'goiv', 'puzzle3_candidates.json'), 'w'), indent=1)
